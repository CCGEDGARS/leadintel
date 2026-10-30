import test from 'node:test';
import budget from '../../customer/state-budget.js';
import capacityFixture from '../../customer/test/helpers/workspace-capacity.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {importAesKey,encryptSecret} from '../src/oauth.js';
import {sha256} from '../src/security.js';
import {WORKFLOW_STAGES,approvedContext,normalizeWorkflowConfig,approvalStatus,fingerprint,renderWorkflowMessage,freshEvidence} from '../src/approved-workflow-engine.js';
import {handleApprovedWorkflowRoute} from '../src/approved-workflow-routes.js';
import {executeWorkflowStage,runApprovedWorkflows,researchBuyerContacts,persistWorkflowBuyerResearch} from '../src/approved-workflow-runner.js';
import {workflowAuthorized,workflowDeliveryAuthorized} from '../src/approved-workflow-store.js';
import {runOutreachAutomation as runWithVerification} from '../src/outreach-automation-runner.js';
import {verifyAutomaticEmail} from '../src/automatic-email-verification.js';
import {listConversations,syncConversation,approveConversationPlan,runConversationPlans} from '../src/conversations.js';
import {base64UrlEncode} from '../src/gmail.js';
import {getCrmCompany} from '../src/crm.js';
class Statement{constructor(db,sql){this.db=db;this.sql=sql;this.args=[];}bind(...a){this.args=a;return this;}async first(){return this.db.prepare(this.sql).get(...this.args)||null;}async all(){return {results:this.db.prepare(this.sql).all(...this.args)};}async run(){const result=this.db.prepare(this.sql).run(...this.args);return {meta:{changes:Number(result.changes)}};}}
class DB{constructor(){this.raw=new DatabaseSync(':memory:');this.raw.exec("CREATE TABLE enrichment_policies(workspace_id TEXT PRIMARY KEY,daily_credit_limit INTEGER NOT NULL DEFAULT 3,monthly_credit_limit INTEGER NOT NULL DEFAULT 30,retry_after_days INTEGER NOT NULL DEFAULT 30,allow_personal_email INTEGER NOT NULL DEFAULT 0,phone_lookup_mode TEXT NOT NULL DEFAULT 'on_request')");for(const file of ['0001_initial.sql','0009_customer_saas.sql','0011_master_crm.sql','0012_crm_contact_enrichment.sql','0013_workspace_service_integrations.sql','0019_microsoft_mail.sql','0023_hunter_service_integration.sql','0015_outreach_automation.sql','0022_crm_public_contact_sources.sql','0024_automation_brand_html.sql','0025_contact_suppression.sql','0027_approved_workflow.sql','0041_additional_contact_services.sql','0043_additional_contact_provider_receipts.sql','0045_treg_paid_search.sql','0046_treg_workspace_credentials.sql','0047_paid_phone_permission.sql'])this.raw.exec(fs.readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));}prepare(sql){return new Statement(this.raw,sql);}async batch(statements){this.raw.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());this.raw.exec('COMMIT');return results;}catch(e){this.raw.exec('ROLLBACK');throw e;}}}
const dossierFixture=async()=>({status:'complete',people:[],facts:[],channels:[],sources:[],passes:[]});
const main={website:'https://seller.example/',approved:true,profile:{companyName:'Fixture Industrial',priorityOffers:'industrial automation; custom machinery',idealCustomer:'manufacturers',decisionMakers:'COO',targetMarkets:'Sweden',exclusions:'',opportunityValue:'€50,000',customerPainPoints:'production flow downtime'},market:{strategyApproved:true,icps:[{id:'core',description:'manufacturers',active:true}],signals:[{id:'expansion',name:'Facility expansion',active:true,weight:10,keywords:'new factory; capacity expansion'},{id:'modernization',name:'Modernization',active:true,weight:9,keywords:'automation investment; equipment upgrade'}]}};
const config=normalizeWorkflowConfig({companies:{limit:1,queries:1},buyers:{roles:['COO'],confirmContacts:true},triggers:{minimumScore:50,maxEvidenceAgeDays:90},messages:{subject:'Hello {{company}}',body:'Hello {{firstName}}, {{sender}} offers {{offer}}. Source: {{evidenceUrl}}'},delivery:{timezone:'UTC',dailyLimit:5,sendWindowStart:'09:00',sendWindowEnd:'17:00'}});
async function fixture(){const db=new DB();db.raw.exec("INSERT INTO users(id,email,display_name) VALUES('u1','owner@fixture.test','Owner');INSERT INTO workspaces(id,name,market,owner_user_id) VALUES('w1','First','SE','u1'),('w2','Second','FI','u1');INSERT INTO workspace_members(workspace_id,user_id,role) VALUES('w1','u1','owner');INSERT INTO gmail_connections(workspace_id,user_id,google_email,status) VALUES('w1','u1','owner@fixture.test','connected');");db.raw.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,'u1',datetime('now','+1 day'))").run(await sha256('token'));db.raw.prepare("INSERT INTO customer_workspace_state(workspace_id,payload_json) VALUES('w1',?)").run(JSON.stringify({main}));const key=btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));db.raw.prepare("INSERT INTO workspace_service_integrations(workspace_id,provider,encrypted_api_key,key_hint) VALUES('w1','hunter',?,'test')").run(await encryptSecret('test-hunter',await importAesKey(key)));db.raw.prepare("INSERT INTO workspace_service_integrations(workspace_id,provider,encrypted_api_key,key_hint,metadata_json) VALUES('w1','apollo',?,'test',?)").run(await encryptSecret('test-apollo',await importAesKey(key)),JSON.stringify({discovery_enabled:false,email_enrichment_enabled:true,phone_enrichment_enabled:true}));db.raw.prepare("INSERT INTO workspace_service_integrations(workspace_id,provider,encrypted_api_key,key_hint) VALUES('w1','firecrawl',?,'test')").run(await encryptSecret('test-firecrawl',await importAesKey(key)));return {OAUTH_TOKEN_ENCRYPTION_KEY:key,DB:db,AUTOMATIC_GMAIL_DELIVERY_MODE:'manual_only',APPROVED_WORKFLOW_DELIVERY_MODE:'enabled'};}
async function call(env,body,workspace='w1'){return handleApprovedWorkflowRoute(new Request('https://api.test/api/approved-workflow?workspace_id='+workspace,{method:body?'POST':'GET',headers:{Cookie:'leadintel_session=token','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env,{});}
async function approve(env,selectedConfig=config){let res=await call(env,{action:'save',revision:0,config:selectedConfig});assert.equal(res.status,200);let value=await res.json();for(const stage of WORKFLOW_STAGES){res=await call(env,{action:'approve-stage',revision:value.revision,stage});assert.equal(res.status,200,await res.clone().text());value=await res.json();}res=await call(env,{action:'activate',revision:value.revision,approved:true});assert.equal(res.status,200,await res.clone().text());return res.json();}
async function generateResearch(env,workspaceId,prompt){
 if(prompt.startsWith('Compare verified'))return JSON.stringify({matches:[]});
 const seller=JSON.parse(prompt.split('Seller: ')[1].split('. Companies: ')[0]),companies=JSON.parse(prompt.split('. Companies: ')[1]);
 return JSON.stringify({companies:companies.map(c=>({domain:c.domain,fit:100,purchase:seller.offers[0],reason:'The documented production process uses this equipment.',buyerRole:'manufacturer',needStatus:'inferred',relevantSignalUrls:(c.signals||[]).flatMap(s=>s.evidence.map(e=>e.url)),evidence:c.evidence.filter(e=>new URL(e.url).hostname===c.domain).map(e=>({url:e.url,quote:e.text.slice(0,300)}))}))});
}
test('approval snapshots ignore key order and invalidate affected downstream stages',async()=>{const context=approvedContext(main),stages=await approvalStatus(context,config),approvals=Object.fromEntries(stages.map(s=>[s.stage,{hash:s.hash}]));const changed=normalizeWorkflowConfig({...config,messages:{...config.messages,body:'Changed'}});const status=await approvalStatus(context,changed,approvals);assert.ok(status.slice(0,5).every(s=>s.approved));assert.ok(status.slice(5).every(s=>!s.approved));assert.equal(await fingerprint({b:2,a:1}),await fingerprint({a:1,b:2}));assert.throws(()=>normalizeWorkflowConfig({messages:{body:'{{secret}}'}}),/Unknown/);assert.throws(()=>renderWorkflowMessage('Hello {{firstName}}',{}),/Missing/);assert.equal(freshEvidence({evidence:[{url:'https://a.test',date:''}]},90).length,0);});
test('stage order, final approval, stale writes and workspace isolation are enforced',async()=>{const env=await fixture();assert.equal((await call(env,null,'w2')).status,401);assert.equal((await call(env,{action:'save',revision:0,config})).status,200);assert.equal((await call(env,{action:'approve-stage',revision:1,stage:'messages'})).status,409);assert.equal((await call(env,{action:'activate',revision:1,approved:true})).status,409);assert.equal((await call(env,{action:'save',revision:0,config})).status,409);env.DB.raw.exec('DELETE FROM approved_workflows');const value=await approve(env);assert.equal(value.status,'automatic');assert.equal(env.DB.raw.prepare('SELECT enabled FROM outreach_automation_policies').get().enabled,1);});
test('pause and manual takeover stop execution; context changes require renewed approval',async()=>{const env=await fixture();const v=await approve(env);assert.equal(await workflowAuthorized(env,'w1',v.revision),true);for(const action of ['pause','manual']){assert.equal((await call(env,{action,revision:v.revision})).status,200);assert.equal(await workflowAuthorized(env,'w1',v.revision),false);assert.equal((await call(env,{action:'resume',revision:v.revision})).status,200);}const changed={...main,profile:{...main.profile,priorityOffers:'Different offer'}};env.DB.raw.prepare("UPDATE customer_workspace_state SET payload_json=? WHERE workspace_id='w1'").run(JSON.stringify({main:changed}));assert.equal(await workflowAuthorized(env,'w1',v.revision),false);assert.equal(env.DB.raw.prepare('SELECT status FROM approved_workflows').get().status,'needs_review');assert.equal((await call(env,{action:'resume',revision:v.revision})).status,409);});
test('server checkpoints all stages once and schedules cycles without repeated confirmation',async()=>{const env=await fixture();await approve(env);const calls=[];const execute=async(stage,{guard,result})=>{await guard();calls.push(stage);return {...result,stage};};assert.equal((await runApprovedWorkflows(env,{execute})).completed,1);assert.deepEqual(calls,WORKFLOW_STAGES);await runApprovedWorkflows(env,{execute});assert.equal(calls.length,8);const run=env.DB.raw.prepare('SELECT * FROM approved_workflow_runs').get();assert.equal(run.status,'completed');assert.equal(run.stage_index,8);assert.equal(await workflowDeliveryAuthorized(env,{workspace_id:'w1',workflow_run_id:run.id,workflow_revision:1}),true);await call(env,{action:'stop',revision:1});assert.equal(await workflowDeliveryAuthorized(env,{workspace_id:'w1',workflow_run_id:run.id,workflow_revision:1}),false);});
test('provider failure blocks and explicit retry resumes the saved stage',async()=>{const env=await fixture();await approve(env);let broken=true;const calls=[];const execute=async(stage,{result})=>{calls.push(stage);if(stage==='buyers'&&broken)throw new Error('Provider credits exhausted');return result;};assert.equal((await runApprovedWorkflows(env,{execute})).blocked,1);const run=env.DB.raw.prepare('SELECT * FROM approved_workflow_runs').get();assert.equal(run.stage_index,3);await runApprovedWorkflows(env,{execute});assert.equal(calls.length,4);broken=false;assert.equal((await call(env,{action:'retry',revision:1,runId:run.id})).status,200);assert.equal((await runApprovedWorkflows(env,{execute})).completed,1);assert.deepEqual(calls.slice(4),WORKFLOW_STAGES.slice(3));});
test('pause during a stage prevents downstream work and a completion claim',async()=>{const env=await fixture();await approve(env);const calls=[];await runApprovedWorkflows(env,{execute:async(stage,{result})=>{calls.push(stage);if(stage==='companies')await call(env,{action:'pause',revision:1});return result;}});assert.deepEqual(calls,['profile','strategy','companies']);assert.equal(env.DB.raw.prepare('SELECT status FROM approved_workflow_runs').get().status,'blocked');});
test('native research through one confirmed send, reply-stop and CRM reopening uses controlled providers',async()=>{
  const env=await fixture();await approve(env);env.DB.raw.exec("INSERT INTO crm_companies(id,workspace_id,normalized_domain,company_name,lifecycle_status,first_seen_at,last_seen_at,created_at,updated_at) VALUES('c1','w1','nordicmachines.se','Nordic Machines','prospect',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);INSERT INTO crm_contacts(id,workspace_id,company_id,name,title,work_email,normalized_email,email_status,source,created_at,updated_at) VALUES('p1','w1','c1','Alex Example','COO','alex@nordicmachines.se','alex@nordicmachines.se','verified','apollo',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);");
  const oldFetch=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({data:[{url:'https://industrialjournal.se/nordic-investment',title:'Nordic Machines investment confirmed',markdown:'Nordic Machines announced a new factory in Sweden. The project expands manufacturing capacity with industrial automation and custom machinery, according to the company investment announcement.',date:new Date().toISOString()},{url:'https://nordicmachines.se/news',title:'Nordic Machines factory expansion',description:'Swedish manufacturer expanding capacity',markdown:'Swedish manufacturer in Sweden with 100 employees announces a new factory and capacity expansion with industrial automation and custom machinery. Production equipment upgrade and automation investment budget €100,000.',date:new Date().toISOString()}]}),{status:200});};
  try{assert.equal((await runApprovedWorkflows(env,{execute:(stage,args)=>executeWorkflowStage(stage,{...args,generateResearch,researchDossier:dossierFixture})})).completed,1);const run=env.DB.raw.prepare('SELECT * FROM approved_workflow_runs').get(),result=JSON.parse(run.result_json);assert.equal(result.candidates.length,1,JSON.stringify(result));assert.equal(result.queued,1);assert.ok(calls>=2);assert.equal(env.DB.raw.prepare('SELECT workflow_run_id FROM outreach_automation_sequences').get().workflow_run_id,run.id);const now=new Date();now.setUTCDate(now.getUTCDate()+((4-now.getUTCDay()+7)%7));now.setUTCHours(12,0,0,0);env.DB.raw.prepare('UPDATE outreach_automation_queue SET scheduled_send_at=?').run(now.toISOString());let sent=0;const response=await runOutreachAutomation(env,{now,sendMessage:async({queue})=>{sent++;assert.match(queue.body,/Alex/);return {id:'mock-gmail',threadId:'mock-thread'};}});assert.equal(response.sent,1);assert.equal(sent,1);await runOutreachAutomation(env,{now,sendMessage:async()=>{sent++;}});assert.equal(sent,1);
    const storageSchema=fs.readFileSync(new URL('../migrations/0031_workspace_storage.sql',import.meta.url),'utf8');
    env.DB.raw.exec(storageSchema.slice(0,storageSchema.indexOf('INSERT INTO workspace_storage_accounts')));
    env.DB.raw.exec(fs.readFileSync(new URL('../migrations/0049_supervised_follow_up.sql',import.meta.url),'utf8'));
    env.DB.raw.exec(fs.readFileSync(new URL('../migrations/0063_conversation_workflows.sql',import.meta.url),'utf8'));
    const scope={workspaceId:'w1',userId:'u1',role:'owner'},message=env.DB.raw.prepare("SELECT * FROM gmail_messages WHERE status='sent'").get();
    assert.equal(message.recipient,'alex@nordicmachines.se');
    assert.equal(env.DB.raw.prepare("SELECT pipeline_stage FROM crm_companies WHERE id='c1'").get().pipeline_stage,'Contacted');
    const queue=env.DB.raw.prepare("SELECT * FROM outreach_automation_queue WHERE status='sent'").get();
    const original={id:message.gmail_message_id,threadId:message.gmail_thread_id,internalDate:String(now.getTime()),labelIds:['SENT'],payload:{headers:[{name:'From',value:'owner@fixture.test'},{name:'Message-ID',value:'<first@fixture.test>'}],mimeType:'text/plain',body:{data:base64UrlEncode(queue.body)}}};
    const fetchThread=async()=>({id:message.gmail_thread_id,messages:[original]});
    await syncConversation(env,scope,message.id,{now,fetchThread});
    const plan=await approveConversationPlan(env,scope,message.id,{approved:true,steps:[{days:3,body:'Reviewed follow-up for Alex only'}]},{now,fetchThread});
    assert.equal(plan.initialBody,queue.body);
    const replyText='Please send the technical information.',replyTime=new Date(now.getTime()+60000);
    const reply={id:'controlled-inbound',threadId:message.gmail_thread_id,internalDate:String(replyTime.getTime()),labelIds:['INBOX'],payload:{headers:[{name:'From',value:'alex@nordicmachines.se'}],mimeType:'text/plain',body:{data:base64UrlEncode(replyText)}}};
    const replied=await syncConversation(env,scope,message.id,{now:replyTime,fetchThread:async()=>({id:message.gmail_thread_id,messages:[original,reply]})});
    assert.equal(replied.plan.status,'stopped_reply');
    await runConversationPlans(env,{now:new Date(replyTime.getTime()+7*86400000),fetchThread,sendMessage:async()=>{sent++;throw Error('Reply must stop follow-ups');}});
    assert.equal(sent,1,'only the initial provider-confirmed email was sent');
    const reopened=await getCrmCompany(env.DB,scope,'c1');assert.equal(reopened.company.pipeline_stage,'Replied');
    assert.ok(reopened.activities.some(a=>a.activity_type==='email.sent'));assert.match(JSON.stringify(reopened.activities),/Please send the technical information/);
    assert.equal((await listConversations(env,{...scope,workspaceId:'w2'},{now:replyTime})).conversations.length,0);
  }finally{globalThis.fetch=oldFetch;}
});
test('expired execution leases block automatic replay and revoked ownership stops execution',async()=>{const env=await fixture();await approve(env);env.DB.raw.exec("INSERT INTO approved_workflow_runs(id,workspace_id,revision,status,lease_token,lease_until) VALUES('stale','w1',1,'running','old','2000-01-01T00:00:00.000Z')");let calls=0;const outcome=await runApprovedWorkflows(env,{execute:async()=>{calls++;return {};}});assert.equal(outcome.blocked,1);assert.equal(calls,0);assert.match(env.DB.raw.prepare("SELECT error_message FROM approved_workflow_runs WHERE id='stale'").get().error_message,/interrupted/);env.DB.raw.exec("UPDATE workspace_members SET role='sales' WHERE workspace_id='w1'");assert.equal(await workflowAuthorized(env,'w1',1),false);assert.equal((await call(env,{action:'pause',revision:1})).status,403);});
test('direct delivery-setting changes invalidate the final workflow approval',async()=>{const env=await fixture();await approve(env);env.DB.raw.exec("INSERT INTO approved_workflow_runs(id,workspace_id,revision,status,stage_index) VALUES('done','w1',1,'completed',8);UPDATE outreach_automation_policies SET workspace_daily_limit=10 WHERE workspace_id='w1'");assert.equal(await workflowDeliveryAuthorized(env,{workspace_id:'w1',workflow_run_id:'done',workflow_revision:1}),false);const row=env.DB.raw.prepare('SELECT status,approved_at FROM approved_workflows').get();assert.equal(row.status,'needs_review');assert.equal(row.approved_at,null);assert.equal((await call(env,{action:'resume',revision:1})).status,409);});
test('confirmed Step 2 targeting overrides stale generated profile across industries',()=>{const first=approvedContext({...main,answers:{priority_offers:'CRM implementation',ideal_customer:'Property agencies',buyer_roles:'Managing Director'},targetMarkets:['Portugal']});const renamed=approvedContext({...main,profile:{...main.profile,companyName:'Another seller'},answers:{priority_offers:'CRM implementation',ideal_customer:'Property agencies',buyer_roles:'Managing Director'},targetMarkets:['Portugal']});assert.equal(first.profile.priorityOffers,'CRM implementation');assert.equal(first.profile.idealCustomer,'Property agencies');assert.equal(first.profile.priorityOffers,renamed.profile.priorityOffers);assert.equal(first.profile.idealCustomer,renamed.profile.idealCustomer);assert.equal(first.profile.targetMarkets,'Portugal');});
test('renewing changed context starts a new revision and cannot resume old stage results',async()=>{const env=await fixture();await approve(env);env.DB.raw.exec("INSERT INTO approved_workflow_runs(id,workspace_id,revision,status,stage_index,result_json) VALUES('old','w1',1,'blocked',3,'{\"candidates\":[{\"company\":\"Old context\"}]}')");const changed={...main,profile:{...main.profile,idealCustomer:'Different manufacturers'}};env.DB.raw.prepare('UPDATE customer_workspace_state SET payload_json=?').run(JSON.stringify({main:changed}));assert.equal(await workflowAuthorized(env,'w1',1),false);const response=await call(env,{action:'approve-stage',revision:1,stage:'profile'});assert.equal(response.status,200,await response.clone().text());const value=await response.json();assert.equal(value.revision,2);assert.equal(value.approvedAt,null);assert.equal(value.stages[0].approved,true);assert.ok(value.stages.slice(1).every(s=>!s.approved));assert.equal(env.DB.raw.prepare("SELECT status FROM approved_workflow_runs WHERE id='old'").get().status,'stopped');});

test('qualification priority and selectable thresholds persist and invalidate company/downstream approvals',async()=>{
 const env=await fixture();await approve(env);
 const next={...config,qualificationVersion:2,companies:{...config.companies,researchPriority:'signals'},triggers:{...config.triggers,minimumScore:90}};
 const saved=await call(env,{action:'save',revision:1,config:next});assert.equal(saved.status,200);const data=await saved.json();assert.equal(data.status,'needs_review');assert.equal(data.config.companies.researchPriority,'signals');assert.equal(data.config.triggers.minimumScore,90);assert.equal(data.approvedAt,null);
 assert.ok(data.stages.slice(0,2).every(s=>s.approved));assert.ok(data.stages.slice(2).every(s=>!s.approved));assert.equal(await workflowAuthorized(env,'w1',1),false);
 const read=await (await call(env)).json();assert.equal(read.config.triggers.minimumScore,90);assert.equal(read.config.companies.researchPriority,'signals');
 const stored=JSON.parse(env.DB.raw.prepare('SELECT config_json FROM approved_workflows WHERE workspace_id=?').get('w1').config_json);assert.equal(stored.triggers.minimumScore,90);assert.equal(stored.companies.researchPriority,'signals');
 assert.throws(()=>normalizeWorkflowConfig({...next,triggers:{...next.triggers,minimumScore:75}}),/70, 80 or 90/);
 assert.throws(()=>normalizeWorkflowConfig({...next,companies:{...next.companies,researchPriority:'unknown'}}),/Lookalike/);
});

test('checked 80+ Lookalike company fit can advance without inventing a buying signal',async()=>{
 const env=await fixture(),guard=async()=>{};
 const model={active:true,dna:{active:true,referenceProfiles:[{rowId:'r',companyName:'Reference',dimensions:[{key:'industry',values:['renewable energy']},{key:'productionModel',values:['modular components']},{key:'capabilities',values:['steel structures']}]}]}};
 model.dna.referenceProfiles[0].sourceEvidence=model.dna.referenceProfiles[0].dimensions.map(d=>({field:d.key,url:'https://reference.example/about',quote:'Reference manufactures '+d.values[0]+' for customers.'}));
 const context={...approvedContext(main),signals:[],profile:{companyName:'Seller',website:'seller.example',targetMarkets:'Sweden',idealCustomer:'renewable energy manufacturers',priorityOffers:'steel structures; modular components',referenceSimilarityModel:model}};
 const config=normalizeWorkflowConfig({qualificationVersion:2,companies:{limit:1,queries:2,researchPriority:'lookalike'},triggers:{minimumScore:90},buyers:{roles:['COO']},messages:{subject:'Hello {{company}}',body:'Hello {{firstName}}. Relevant source: {{evidenceUrl}}'}});
 const official={url:'https://nordic.se/products',title:'Nordic products',markdown:'Nordic manufactures steel structures and modular components for renewable energy equipment in Sweden. Its factory supports wind energy manufacturers with engineered components.'};
 const independent={url:'https://industry.example/nordic',title:'Nordic renewable energy equipment',markdown:'Nordic manufactures modular components and steel structures for renewable energy projects in Sweden, according to its industry association listing. The company supplies wind energy manufacturers.'};
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({data:[official,independent]}),{status:200});
 try{
  const result=await executeWorkflowStage('companies',{env,row:{workspace_id:'w1',approved_by:'u1'},run:{id:'lookalike-fit'},context,config,result:{},guard,generateResearch});
  assert.equal(result.candidates.length,1);assert.equal(result.shortfall,0);
  assert.equal(result.candidates[0].qualification.score,100);
  assert.equal(result.candidates[0].qualification.signalPoints,0);
 }finally{globalThis.fetch=original;}
});
test('automatic company stage admits checked 80+ fit without a current event and holds 79 for manual review',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({data:[
  {url:'https://nordicmachines.se/products',title:'Nordic Machines',markdown:'Nordic Machines operates manufacturing facilities in Sweden. Its production lines use industrial automation and custom machinery purchased from specialist engineering partners for internal factory operations.'},
  {url:'https://industrialjournal.se/nordic',title:'Nordic Machines',markdown:'Nordic Machines manufactures industrial machinery in Sweden for international business customers, with several engineering teams and a long history of mechanical production for export markets.'}
 ]}),{status:200});
 try{for(const score of [79,80]){
  const env=await fixture();
  const result=await executeWorkflowStage('companies',{env,row:{workspace_id:'w1',approved_by:'u1'},run:{id:`score-${score}`},context:approvedContext(main),config,result:{},guard:async()=>{},generateResearch:async(e,w,prompt)=>{
   const value=JSON.parse(await generateResearch(e,w,prompt));if(value.companies)for(const c of value.companies)c.fit=score;return JSON.stringify(value);
  }});
  assert.equal(result.candidates.length,score>=80?1:0,JSON.stringify(result));
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM crm_companies').get().n,score>=80?1:0);
 }}finally{globalThis.fetch=original;}
});
test('the ranked-list contract invalidates old company and downstream automatic approvals',async()=>{
 const context=approvedContext(main),old={...config,qualificationVersion:3};
 const approvals=Object.fromEntries((await approvalStatus(context,old)).map(s=>[s.stage,{hash:s.hash}]));
 const updated=normalizeWorkflowConfig(config),stages=await approvalStatus(context,updated,approvals);
 assert.equal(updated.qualificationVersion,4);
 assert.ok(stages.slice(0,2).every(s=>s.approved));assert.ok(stages.slice(2).every(s=>!s.approved));
});
test('generic automatic messages can cite a currently checked official source without a buying event',async()=>{
 const env=await fixture(),at=new Date().toISOString(),candidate={company:'Nordic Machines',domain:'nordicmachines.se',contact:{id:'c1',name:'Anna Buyer'},qualification:{route:'signal',score:80},evidence:[{url:'https://nordicmachines.se/products',verifiedAt:at,text:'Nordic Machines operates manufacturing facilities in Sweden.'}]};
 const run=async(c)=>executeWorkflowStage('messages',{env,row:{workspace_id:'w1'},context:approvedContext(main),config,result:{candidates:[c]},guard:async()=>{}});
 const value=await run(candidate);assert.equal(value.candidates.length,1);assert.match(value.candidates[0].message.body,/https:\/\/nordicmachines.se\/products/);
 const stale=await run({...candidate,evidence:candidate.evidence.map(e=>({...e,verifiedAt:'2020-01-01T00:00:00Z'}))});
 assert.equal(stale.candidates.length,0);assert.equal(stale.reviewMessages.length,1);
});
test('unattended execution rejects old contract approvals before research or delivery without opening the UI',async()=>{
 const env=await fixture();await approve(env);
 const context=approvedContext(main),old={...config,qualificationVersion:3};
 const approvals=Object.fromEntries((await approvalStatus(context,old)).map(s=>[s.stage,{hash:s.hash,at:new Date().toISOString(),by:'u1'}]));
 env.DB.raw.prepare('UPDATE approved_workflows SET config_json=?,approvals_json=?').run(JSON.stringify(old),JSON.stringify(approvals));
 let executed=0;await runApprovedWorkflows(env,{execute:async()=>{executed++;return {};}});
 assert.equal(executed,0,'a contract change must not start research or outreach under old approval');
 assert.equal(env.DB.raw.prepare('SELECT status FROM approved_workflows').get().status,'needs_review');
 env.DB.raw.exec("INSERT INTO approved_workflow_runs(id,workspace_id,revision,status,stage_index) VALUES('old-approved-delivery','w1',1,'completed',8)");
 assert.equal(await workflowDeliveryAuthorized(env,{workspace_id:'w1',workflow_run_id:'old-approved-delivery',workflow_revision:1}),false);
});
test('automatic buyers research a public pool and prioritize kept verified buyers in the same workspace',async()=>{
 const env=await fixture();
 env.DB.raw.exec("INSERT INTO crm_companies(id,workspace_id,normalized_domain,company_name,lifecycle_status,first_seen_at,last_seen_at,created_at,updated_at) VALUES('c1','w1','example.com','Example','prospect',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);INSERT INTO crm_contacts(id,workspace_id,company_id,name,title,normalized_email,email_status,source,linkedin_url,created_at,updated_at) VALUES('a','w1','c1','First Buyer','COO','first@example.com','verified','apollo','https://linkedin.com/in/first',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),('b','w1','c1','Saved Buyer','COO','saved@example.com','verified','apollo','https://linkedin.com/in/saved',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
 const payload=capacityFixture();payload.main={...payload.main,...main};payload.discovery.selectedProspects[0]={...payload.discovery.selectedProspects[0],domain:'example.com',people:[{name:'Saved Buyer',title:'COO',publicLinkedinUrl:'https://linkedin.com/in/saved',kept:true}]};
 env.DB.raw.prepare('UPDATE customer_workspace_state SET payload_json=? WHERE workspace_id=?').run(JSON.stringify(budget.prepareForSync(payload,{allowBundlePacking:true,allowCompressionPacking:true}).payload),'w1');
 const oldFetch=globalThis.fetch;let apollo=0,publicSearches=0;
 globalThis.fetch=async(url)=>{if(String(url).includes('apollo.io')){apollo++;throw new Error('Unexpected enrichment');}publicSearches++;return new Response(JSON.stringify({data:[...Array.from({length:20},(_,i)=>({url:`https://linkedin.com/in/person-${i}`,title:`Anna Buyer${String.fromCharCode(65+i)} – COO at Example`})),{url:'https://example.com/team',title:'Team',markdown:'Saved Buyer — COO at Example. Current company leadership.'}]}),{status:200});};
 try{
  const result=await executeWorkflowStage('buyers',{researchDossier:dossierFixture,env,row:{workspace_id:'w1',approved_by:'u1'},context:approvedContext(main),config,result:{candidates:[{company:'Example',domain:'example.com'}]},guard:async()=>{}});
  assert.equal(result.candidates[0].contact.name,'Saved Buyer');assert.equal(result.candidates[0].buyerDiscovery.pool.length,20);assert.equal(result.candidates[0].people.length,10);assert.equal(result.candidates[0].people.filter(p=>p.contactResearch.checks.deep?.status==='complete').length,4);assert.ok(result.candidates[0].people.every(p=>p.emailResearch.searches>=11&&p.emailResearch.searches<=13&&p.contactResearch.checks.gmail.status==='complete'));assert.equal(apollo,0);assert.ok(publicSearches>0);
 }finally{globalThis.fetch=oldFetch;}
});
test('automatic buyers retain public suggestions for review without approved enrichment or verified emails',async()=>{
 const env=await fixture(),oldFetch=globalThis.fetch;let apollo=0;
 globalThis.fetch=async(url)=>{if(String(url).includes('apollo.io'))apollo++;return new Response(JSON.stringify({data:[{url:'https://linkedin.com/in/anna',title:'Anna Buyer – COO at Example'}]}),{status:200});};
 try{
  const manualConfig=normalizeWorkflowConfig({...config,buyers:{roles:['COO'],enrich:false}});
  const result=await executeWorkflowStage('buyers',{researchDossier:dossierFixture,env,row:{workspace_id:'w1',approved_by:'u1'},context:approvedContext(main),config:manualConfig,result:{candidates:[{company:'Example',domain:'example.com'}]},guard:async()=>{}});
  assert.equal(result.candidates.length,0);assert.equal(result.reviewBuyers.length,1);assert.equal(result.reviewBuyers[0].people[0].name,'Anna Buyer');assert.equal(apollo,0);
 }finally{globalThis.fetch=oldFetch;}
});
test('a verified CRM recipient cannot bypass a retained role hold outside the visible shortlist',async()=>{
 const env=await fixture(),oldFetch=globalThis.fetch;
 env.DB.raw.exec("INSERT INTO crm_companies(id,workspace_id,normalized_domain,company_name,lifecycle_status,first_seen_at,last_seen_at,created_at,updated_at) VALUES('c1','w1','example.com','Example','prospect',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);INSERT INTO crm_contacts(id,workspace_id,company_id,name,title,work_email,normalized_email,email_status,source,created_at,updated_at) VALUES('paul','w1','c1','Paul Pepper','Managing Director','paul.pepper@example.com','paul.pepper@example.com','verified','apollo',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
 const hold={id:'paul',name:'Paul Pepper',title:'Managing Director',organization:'Example',publicNameUrl:'https://linkedin.com/in/paul-pepper',publicLinkedinUrl:'https://linkedin.com/in/paul-pepper',roleReview:{version:1,status:'unconfirmed',reason:'Current executive role uncorroborated',checkedAt:new Date().toISOString(),sources:[]}};
 env.DB.raw.prepare('UPDATE customer_workspace_state SET payload_json=? WHERE workspace_id=?').run(JSON.stringify({main,discovery:{selectedProspects:[{company:'Example',domain:'example.com',people:[hold],buyerDiscovery:{pool:[hold]}}]}}),'w1');
 globalThis.fetch=async()=>new Response(JSON.stringify({data:['Anna Andersson','Bertil Berg','Carl Carlson','Dora Dahl','Erik Eriksson','Fredrik Fjell','Gustav Gustafsson'].map(name=>({url:'https://example.com/team/'+name.toLowerCase().replaceAll(' ','-'),title:name+' | COO | Example',markdown:name+' COO Example. Current company leadership.'}))}),{status:200});
 try{
  const result=await executeWorkflowStage('buyers',{researchDossier:dossierFixture,env,row:{workspace_id:'w1',approved_by:'u1'},context:approvedContext(main),config:normalizeWorkflowConfig({buyers:{roles:['COO'],confirmContacts:false,confirmPhone:false}}),result:{candidates:[{company:'Example',domain:'example.com',market:'Sweden'}]},guard:async()=>{}});
  assert.equal(result.candidates.length,0);assert.equal(result.reviewBuyers.length,1);
  assert.equal(result.reviewBuyers[0].buyerDiscovery.pool.find(person=>person.name==='Paul Pepper')?.roleReview?.status,'unconfirmed');
 }finally{globalThis.fetch=oldFetch;}
});

function runOutreachAutomation(env,options={}){return runWithVerification(env,{verifyEmail:async()=>({verified:true,provider:'test'}),...options});}


test('automatic companies stage persists only gate-passing qualified candidates to CRM before Buyers',async()=>{
  const source=fs.readFileSync(new URL('../src/approved-workflow-runner.js',import.meta.url),'utf8');
  const companiesBlock=source.slice(source.indexOf("if(stage==='companies')"),source.indexOf("if(stage==='buyers')"));
  assert.match(companiesBlock,/assessed\.filter\(c=>c\.qualification\.eligible\)/);
  assert.match(companiesBlock,/config\.crm\.saveQualified/);
  assert.match(companiesBlock,/source:'approved_workflow_qualified'/);
  assert.match(companiesBlock,/automaticQualifiedSave:true/);
  assert.ok(companiesBlock.indexOf("assessed.filter(c=>c.qualification.eligible)")<companiesBlock.indexOf("source:'approved_workflow_qualified'"));
});

test('automatic CRM save contract defaults on and minimum qualification remains 80 unless explicitly approved otherwise',()=>{
  const defaults=normalizeWorkflowConfig({companies:{researchPriority:'balanced'},buyers:{roles:['COO']},messages:{subject:'Hi {{company}}',body:'Hi {{firstName}} {{evidenceUrl}}'}});
  assert.equal(defaults.triggers.minimumScore,80);
  assert.equal(defaults.crm.saveQualified,true);
});

test('automatic Buyers combine directory discovery with four public buyers and resolve pending names without paid enrichment',async()=>{
 const env=await fixture();
 env.DB.raw.prepare("INSERT OR REPLACE INTO workspace_service_integrations(workspace_id,provider,encrypted_api_key,key_hint,metadata_json) VALUES('w1','apollo',?,'test','{\"discovery_enabled\":true,\"email_enrichment_enabled\":true,\"phone_enrichment_enabled\":true}')").run(await encryptSecret('test-apollo',await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY)));
 const oldFetch=globalThis.fetch,requests=[];globalThis.fetch=async(url,options={})=>{
  requests.push(String(url));
  if(String(url).includes('api_search'))return new Response(JSON.stringify({people:[{id:'anna-directory',first_name:'Anna',last_name_obfuscated:'A****',title:'Procurement Director',organization:{name:'Nordic Machines'}}]}));
  const query=JSON.parse(options.body||'{}').query||'';
  const rows=query.includes('"Anna"')?[{title:'Anna Andersson | Procurement Director | Nordic Machines',url:'https://linkedin.com/in/anna-andersson'}]:['Bertil Berg','Carl Carlson','Dora Dahl','Erik Ek'].map(name=>({title:`${name} | Project Director | Nordic Machines`,url:'https://linkedin.com/in/'+name.replace(/ /g,'-')}));
  return new Response(JSON.stringify({data:rows}));
 };
 try{
  const output=await executeWorkflowStage('buyers',{researchDossier:dossierFixture,env,row:{workspace_id:'w1',approved_by:'u1'},result:{candidates:[{company:'Nordic Machines',domain:'nordicmachines.se',market:'Sweden'}]},context:approvedContext(main),config:normalizeWorkflowConfig({buyers:{roles:['Project Director','Procurement Director'],confirmContacts:false}}),guard:async()=>{}});
  const candidate=output.reviewBuyers[0];assert.equal(candidate.people.length,5);
  const anna=candidate.people.find(p=>p.name==='Anna Andersson');assert.ok(anna);assert.equal(anna.id,'anna-directory');assert.equal(anna.identityStatus,'confirmed');
  assert.equal(requests.filter(url=>url.includes('api_search')).length,1);assert.equal(requests.some(url=>url.includes('people/match')),false);
  assert.equal(candidate.buyerDiscovery.pool.some(p=>p.identityStatus==='pending'),false);
 }finally{globalThis.fetch=oldFetch;}
});


test('automatic buyer confirmation uses approved Apollo reveal within workspace limits',async()=>{
 const env=await fixture();env.DB.raw.exec("INSERT INTO additional_contact_policies(workspace_id,enabled,provider) VALUES('w1',0,'apollo')");env.DB.raw.prepare("INSERT OR REPLACE INTO workspace_service_integrations(workspace_id,provider,encrypted_api_key,key_hint,metadata_json) VALUES('w1','apollo',?,'test','{\"discovery_enabled\":true,\"email_enrichment_enabled\":true,\"phone_enrichment_enabled\":true}')").run(await encryptSecret('test-apollo',await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY)));
 env.DB.raw.exec(fs.readFileSync(new URL('../migrations/0010_workspace_ai_integrations.sql',import.meta.url),'utf8'));env.DB.raw.prepare("INSERT INTO workspace_ai_integrations(workspace_id,provider,encrypted_api_key,key_hint,model,active) VALUES('w1','gemini',?,'test','gemini-fixture',1)").run(await encryptSecret('test-gemini',await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY)));
 const oldFetch=globalThis.fetch,requests=[];globalThis.fetch=async (url,options={})=>{requests.push(String(url));if(String(url).includes('generativelanguage.googleapis.com')){const body=JSON.parse(options.body);if(body.tools?.some(tool=>tool.google_search))return Response.json({candidates:[{groundingMetadata:{webSearchQueries:['Anna Andersson Example contact'],groundingChunks:[]}}]});const input=JSON.parse(body.contents[0].parts[0].text);return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({reviewed_person_ids:input.people.map(p=>p.id),conflicts:[]})}]}}]});}return new Response(JSON.stringify(String(url).includes('api_search')?{people:[{id:'anna',name:'Anna Andersson',title:'COO',organization:{name:'Example'}}]}:String(url).includes('people/match')?{person:{id:'anna',name:'Anna Andersson',title:'COO',email:'anna@example.com',email_status:'verified',organization:{name:'Example',primary_domain:'example.com'}}}:{data:[{url:'https://example.com/team',title:'Team',markdown:'Anna Andersson — COO at Example. Current company leadership.'}]}));};
 try{const output=await executeWorkflowStage('buyers',{researchDossier:dossierFixture,env,row:{workspace_id:'w1',approved_by:'u1'},result:{candidates:[{company:'Example',domain:'example.com'}]},context:approvedContext(main),config:normalizeWorkflowConfig({buyers:{roles:['COO'],confirmContacts:true}}),guard:async()=>{}});assert.equal(output.candidates[0].contact.email,'anna@example.com');assert.equal(requests.some(url=>url.includes('people/match')),true);assert.equal(requests.some(url=>url.includes('hunter.io')),false);}finally{globalThis.fetch=oldFetch;}
});
test('new automatic contact selection stops when AI supervision is unavailable',async()=>{
 const env=await fixture();env.DB.raw.prepare("INSERT OR REPLACE INTO workspace_service_integrations(workspace_id,provider,encrypted_api_key,key_hint,metadata_json) VALUES('w1','apollo',?,'test','{\"discovery_enabled\":true,\"email_enrichment_enabled\":true,\"phone_enrichment_enabled\":true}')").run(await encryptSecret('test-apollo',await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY)));
 const oldFetch=globalThis.fetch,requests=[];globalThis.fetch=async url=>{requests.push(String(url));return new Response(JSON.stringify(String(url).includes('api_search')?{people:[{id:'anna',name:'Anna Andersson',title:'COO',organization:{name:'Example'}}]}:String(url).includes('people/match')?{person:{id:'anna',name:'Anna Andersson',title:'COO',email:'anna@example.com',email_status:'verified',organization:{name:'Example',primary_domain:'example.com'}}}:{data:[{url:'https://example.com/team',title:'Team',markdown:'Anna Andersson — COO at Example. Current company leadership.'}]}));};
 try{const output=await executeWorkflowStage('buyers',{researchDossier:dossierFixture,env,row:{workspace_id:'w1',approved_by:'u1'},result:{candidates:[{company:'Example',domain:'example.com'}]},context:approvedContext(main),config:normalizeWorkflowConfig({buyers:{roles:['COO'],confirmContacts:true}}),guard:async()=>{}});assert.equal(output.candidates[0]?.contact,undefined);assert.equal(requests.some(url=>url.includes('people/match')),false);assert.equal(requests.some(url=>url.includes('hunter.io')),false);}finally{globalThis.fetch=oldFetch;}
});
test('workflow activation and stage approval work without any Hunter integration',async()=>{
 const env=await fixture();env.DB.raw.exec("DELETE FROM workspace_service_integrations WHERE provider='hunter'");
 const data=await approve(env);assert.equal(data.status,'automatic');assert.equal(data.blockers.some(reason=>/hunter/i.test(reason)),false);
});

test('public confirmation workflow can be approved without paid email, phone or Hunter opt-ins',async()=>{const env=await fixture();env.DB.raw.exec("DELETE FROM workspace_service_integrations WHERE provider='hunter';UPDATE workspace_service_integrations SET metadata_json='{}' WHERE provider='apollo'");const selected=normalizeWorkflowConfig({...config,buyers:{roles:['COO'],confirmationLevel:'public_confirmed',confirmContacts:false,confirmPhone:false}});const result=await approve(env,selected);assert.equal(result.status,'automatic');assert.equal(result.config.buyers.confirmationLevel,'public_confirmed');assert.equal(result.config.buyers.confirmContacts,false);assert.equal(result.config.buyers.confirmPhone,false);});

test('automatic contact research discovers official name-linked email and phone without enrichment',async()=>{
 const queries=[],candidate={company:'Fixture Legal',domain:'legal.example',market:'Sweden',people:[{name:'Anna Lind',title:'Managing Director',organization:'Fixture Legal'}]};
 await researchBuyerContacts(candidate,async query=>{queries.push(query);return query==='site:legal.example "Anna Lind"'?[{url:'https://legal.example/team',markdown:'Managing Director Anna Lind: anna.lind@legal.example, +46 70 235 51 61.'}]:[];},async()=>{});
 assert.equal(queries[6],'site:legal.example "Anna Lind"');assert.ok(queries.slice(0,3).every(q=>q.startsWith('site:legal.example (')));assert.equal(candidate.people[0].publicEmail,'anna.lind@legal.example');assert.equal(candidate.people[0].publicPhone,'+46 70 235 51 61');assert.equal(candidate.people[0].emailResearch.status,'complete');assert.equal(candidate.people[0].emailResearch.searches,11);assert.ok(queries.some(query=>query.includes('\"anna.lind@gmail.com\"')));assert.equal(candidate.people[0].contactResearch.checks.gmail.status,'complete');
});

test('automatic messaging quarantines only invalid company drafts and retains valid candidates',async()=>{
 const env=await fixture();
 const context=approvedContext(main);
 const base={company:'Nordic Machines',domain:'nordicmachines.se',contact:{id:'buyer1',name:'Alex Example',first_name:'Alex',email:'alex@nordicmachines.se'},evidence:[{url:'https://nordicmachines.se/news',date:new Date().toISOString()}]};
 const valid={...base};
 const invalid={...base,company:'Missing Evidence AB',domain:'missingevidence.se',contact:{id:'buyer2',name:'Sam Example',first_name:'Sam',email:'sam@missingevidence.se'},evidence:[]};
 const outcome=await executeWorkflowStage('messages',{env,row:{workspace_id:'w1'},run:{id:'r1'},result:{candidates:[valid,invalid]},context:{...context,outreachDefault:null},config,guard:async()=>{}});
 assert.equal(outcome.candidates.length,1);
 assert.equal(outcome.candidates[0].domain,'nordicmachines.se');
 assert.equal(outcome.reviewMessages.length,1);
 assert.equal(outcome.reviewMessages[0].domain,'missingevidence.se');
 assert.equal(outcome.reviewMessages[0].code,'MESSAGE_REVIEW_REQUIRED');
 assert.match(outcome.reviewMessages[0].reason,/Missing message value: evidenceUrl/);
});

test('automatic company discovery reuses scoped search feedback and geographic settings without changing stored research',async()=>{
 const env=await fixture(),context=approvedContext(main),market={icps:context.icps,signals:context.signals};
 const profile=globalThis.LeadIntelDiscovery.effectiveTargetingProfile({...context.profile,website:context.website},market);
 const searchFeedback=globalThis.LeadIntelDiscovery.recordSearchFeedback([],{domain:'north.se',company:'North'},'poor_fit',profile);
 const stored={main,discovery:{searchFeedback,candidates:[{domain:'kept.se',score:{total:68}}]}};
 const before=JSON.stringify(stored);env.DB.raw.prepare("UPDATE customer_workspace_state SET payload_json=? WHERE workspace_id='w1'").run(before);
 const calls=[],original=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{calls.push(JSON.parse(options.body));return new Response(JSON.stringify({data:[{url:'https://journal.se/north',title:'North operates manufacturing facilities',markdown:'North operates industrial manufacturing facilities in Sweden. The company produces machinery and equipment for industrial customers and invests in its production processes.'}]}));};
 try{
  await executeWorkflowStage('companies',{env,row:{workspace_id:'w1',approved_by:'u1'},run:{id:'feedback'},context,config,result:{},guard:async()=>{},generateResearch});
  const marketCalls=calls.filter(c=>!c.query.startsWith('"')&&!c.query.startsWith('site:'));
  assert.ok(marketCalls.length>0);assert.ok(marketCalls.every(c=>c.query.includes('-site:north.se')),'negative example affects future automatic discovery');
  assert.ok(marketCalls.every(c=>c.location==='Sweden'),'actual upstream requests retain market localization');
  assert.ok(calls.every(c=>!c.query.startsWith('"North"')),'a rejected name does not consume paid company verification');
  assert.equal(env.DB.raw.prepare("SELECT payload_json FROM customer_workspace_state WHERE workspace_id='w1'").get().payload_json,before,'acquisition feedback does not rewrite saved research');
 }finally{globalThis.fetch=original;}
});
test('automatic workflow reuses a user-selected published company contact with its actual role and no paid reveal',async()=>{
 const {upsertCrmCompany}=await import('../src/crm.js'),{confirmPublicWorkEmail}=await import('../src/public-email-confirmation.js');
 for(const kept of [true,false]){
  const env=await fixture(),context={workspaceId:'w1',userId:'u1',role:'owner'},target=(await upsertCrmCompany(env.DB,context,{company_name:'Example',domain:'example.com'})).company;
  const person={id:'public-catrin',name:'Catrin Haglund',publicName:'Catrin Haglund',title:'Administration',organization:'Example',publicNameUrl:'https://example.com/team',publicEmail:'catrin@example.com',publicEmailUrl:'https://example.com/team',kept,contactPurpose:'company_contact'};
  await confirmPublicWorkEmail(env,context,target.id,{...person,person_id:person.id,email:person.publicEmail,source_url:person.publicEmailUrl},{loadPage:async()=>({markdown:'**Catrin Haglund**\nAdministration\ncatrin@example.com'})});
  env.DB.raw.prepare("UPDATE customer_workspace_state SET payload_json=? WHERE workspace_id='w1'").run(JSON.stringify({main,discovery:{selectedProspects:[{company:'Example',domain:'example.com',people:[person]}]}}));
  const original=globalThis.fetch,calls=[];globalThis.fetch=async(url)=>{calls.push(String(url));return new Response(JSON.stringify({data:[]}));};
  try{const result=await executeWorkflowStage('buyers',{researchDossier:dossierFixture,env,row:{workspace_id:'w1',approved_by:'u1'},result:{candidates:[{company:'Example',domain:'example.com'}]},context:approvedContext(main),config:normalizeWorkflowConfig({buyers:{roles:['COO'],confirmContacts:false,confirmPhone:true}}),guard:async()=>{}});if(kept){assert.equal(result.candidates[0].contact.email,'catrin@example.com');assert.equal(result.candidates[0].contact.title,'Administration');}else assert.equal(result.candidates.length,0);assert.equal(calls.some(url=>/people\/match|hunter\.io/.test(url)),false);}finally{globalThis.fetch=original;}
 }
});

test('automatic inventory persists for a saved company even with no eligible buyer and preserves other CRM metadata',async()=>{
 const env=await fixture(),context={workspaceId:'w1',userId:'u1',role:'owner'},crm=await import('../src/crm.js');
 const saved=await crm.upsertCrmCompany(env.DB,context,{company:'Example',domain:'example.com'});
 await crm.upsertCrmIntelligence(env.DB,context,saved.company.id,{opportunity_hypothesis:'Preserve me',research_snapshot:{flowId:'existing-flow',custom:'retained'}});
 const inventory=globalThis.LeadIntelDiscovery.officialCompanyContactInventory([{url:'https://example.com/contact',sourceRead:true,markdown:'CEO\n### Jane Smith\n[info@legacy.example](mailto:info@legacy.example)'}],{company:'Example',domain:'example.com'}),candidate={company:'Example',domain:'example.com',people:[],buyerDiscovery:{checkedAt:new Date().toISOString(),officialContactInventory:inventory}};
 assert.equal(await persistWorkflowBuyerResearch(env,context,candidate),true);
 const detail=await crm.getCrmCompany(env.DB,context,saved.company.id);assert.equal(detail.intelligence.opportunity_hypothesis,'Preserve me');assert.equal(detail.intelligence.research_snapshot.custom,'retained');assert.equal(detail.intelligence.research_snapshot.buyerResearch.discovery.officialContactInventory.channels[0].value,'info@legacy.example');assert.equal(detail.contacts.length,0);
 assert.equal(await persistWorkflowBuyerResearch(env,{...context,workspaceId:'w2'},candidate),false);
});

for(const mode of ['email','email_phone','existing_email_phone','fallback_pending','fallback_phone_off','fallback_unapproved','fallback_ambiguous','fallback_disabled','fallback_webhook_missing','fallback_credit_limit'])test('Buyer Agent phone providers and CRM persistence: '+mode,async()=>{
 const fallback=mode.startsWith('fallback'),withPhone=!['email','fallback_phone_off'].includes(mode),existingEmail=mode==='existing_email_phone'||fallback;
 const env=await fixture(),key=await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY);
 if(existingEmail){
  const crm=await import('../src/crm.js');
  const context={workspaceId:'w1',userId:'u1',role:'owner'},saved=await crm.upsertCrmCompany(env.DB,context,{company_name:'Example',domain:'example.com'});
  await crm.upsertCrmContacts(env.DB,context,saved.company.id,[{external_person_id:'anna',name:'Anna Andersson',title:'COO',work_email:'anna.andersson@example.com',email_status:'verified',source:'treg'}]);
  env.DB.raw.exec("UPDATE crm_contacts SET verification_provider='Treg',verified_at=CURRENT_TIMESTAMP");
 }
 env.DB.raw.prepare("INSERT INTO workspace_service_integrations(workspace_id,provider,encrypted_api_key,key_hint,metadata_json) VALUES('w1','treg',?,'test','{}')").run(await encryptSecret('test-treg',key));
 env.DB.raw.exec("INSERT INTO additional_contact_policies(workspace_id,enabled,daily_limit,monthly_limit,max_per_company,approved_by,provider) VALUES('w1',1,5,150,1,'u1','treg');");
 if(withPhone)env.DB.raw.exec("UPDATE additional_contact_policies SET phone_enabled=1 WHERE workspace_id='w1'");
 if(existingEmail)env.DB.raw.exec("UPDATE additional_contact_policies SET enabled=0 WHERE workspace_id='w1'");
 env.DB.raw.exec(fs.readFileSync(new URL('../migrations/0010_workspace_ai_integrations.sql',import.meta.url),'utf8'));
 env.DB.raw.prepare("INSERT INTO workspace_ai_integrations(workspace_id,provider,encrypted_api_key,key_hint,model,active) VALUES('w1','gemini',?,'test','gemini-fixture',1)").run(await encryptSecret('test-gemini',key));
 if(fallback){env.DB.raw.exec("INSERT OR IGNORE INTO enrichment_policies(workspace_id) VALUES('w1')");env.APOLLO_WEBHOOK_URL=mode==='fallback_webhook_missing'?'':'https://api.test/api/webhooks/apollo/crm-contact';env.APOLLO_WEBHOOK_SECRET='fixture-signing';env.DB.raw.prepare("UPDATE workspace_service_integrations SET metadata_json=? WHERE workspace_id='w1' AND provider='apollo'").run(JSON.stringify({discovery_enabled:true,email_enrichment_enabled:true,phone_enrichment_enabled:mode!=='fallback_disabled'}));env.DB.raw.exec("UPDATE enrichment_policies SET daily_credit_limit="+(mode==='fallback_credit_limit'?8:30)+" WHERE workspace_id='w1'");}
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,options={})=>{
  calls.push(String(url));
  if(String(url).includes('generativelanguage.googleapis.com')){const body=JSON.parse(options.body);if(body.tools?.some(tool=>tool.google_search))return Response.json({candidates:[{groundingMetadata:{webSearchQueries:['Anna Andersson Example contact'],groundingChunks:[]}}]});const input=JSON.parse(body.contents[0].parts[0].text);return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({reviewed_person_ids:input.people.map(p=>p.id),conflicts:[]})}]}}]});}
  if(String(url).includes('phone.find'))return Response.json(fallback?{output:{}}:{output:{phone:'+37120000001'}},{headers:{'X-Treg-Call-Id':'phone-call','X-Treg-Cost-Micro':'125000'}});
  if(String(url).includes('people.enrich'))return Response.json({output:{full_name:'Anna Andersson',company_domain:'example.com',title:'COO'}},{headers:{'X-Treg-Call-Id':'profile-call','X-Treg-Cost-Micro':'4000'}});
  if(String(url).includes('treg.to/call/'))return Response.json(String(url).includes('email.find')?{output:{email:'anna.andersson@example.com',first_name:'Anna',last_name:'Andersson'},raw:{},_treg:{provider:'test-finder'}}:{output:{email:'anna.andersson@example.com',status:'valid'},raw:{email:'anna.andersson@example.com',is_accept_all:false},_treg:{provider:'test-verifier'}},{headers:{'X-Treg-Call-Id':String(url).includes('email.find')?'find-call':'verify-call','X-Treg-Cost-Micro':'4000'}});
  if(String(url).includes('/people/match'))return Response.json({request_id:'async-fixture',person:{id:'anna',name:'Anna Andersson',title:'COO',organization:{primary_domain:'example.com'}}});
  if(fallback&&String(url).includes('api_search'))return Response.json({people:(mode==='fallback_ambiguous'?['anna','anna-other']:['anna']).map(id=>({id,name:'Anna Andersson',title:'COO',organization:{name:'Example'}}))});
  if(String(url).includes('/v2/scrape'))return Response.json({data:{markdown:'# Team\nAnna Andersson — COO at Example. Current company leadership.',links:[]}});
  return Response.json(String(url).includes('api_search')?{people:[{id:'anna',name:'Anna Andersson',title:'COO',organization:{name:'Example'}}]}:{data:[{url:'https://example.com/team',title:'Anna Andersson | COO | Example',markdown:'Anna Andersson — COO at Example. Current company leadership.'}]});
 };
 try{
  const config=normalizeWorkflowConfig({messages:{subject:'Hello {{firstName}}',body:'Hello {{firstName}} at {{company}}'},buyers:{roles:['COO'],confirmContacts:false,confirmPhone:fallback&&mode!=='fallback_unapproved',confirmationLevel:'provider_verified'}}),candidate={company:'Example',domain:'example.com',qualification:{eligible:true,score:85,researchedAt:new Date().toISOString()}};
  const result=await executeWorkflowStage('buyers',{researchDossier:dossierFixture,env,row:{workspace_id:'w1',approved_by:'u1'},context:approvedContext(main),config,result:{candidates:[candidate]},guard:async()=>{}});
  assert.equal(result.candidates[0]?.contact.email,'anna.andersson@example.com',JSON.stringify({issues:result.reviewBuyers?.[0]?.buyerDiscovery?.issues,people:result.reviewBuyers?.[0]?.people,accountability:result.reviewBuyers?.[0]?.publicResearch?.accountability}));
  assert.equal(calls.filter(url=>url.includes('treg.to/call/')).length,existingEmail?(withPhone?1:0):withPhone?4:2,JSON.stringify({issues:result.candidates[0]?.buyerDiscovery?.issues,people:result.candidates[0]?.people.map(p=>({id:p.id,name:p.name,title:p.title}))}));assert.equal(calls.filter(url=>url.includes('/people/match')).length,mode==='fallback_pending'?1:0,JSON.stringify({trace:result.candidates[0]?.buyerDiscovery?.phoneEnrichment,issues:result.candidates[0]?.buyerDiscovery?.issues,calls}));assert.equal(calls.some(url=>url.includes('hunter.io')),false);
  const contact=env.DB.raw.prepare("SELECT * FROM crm_contacts WHERE normalized_email='anna.andersson@example.com'").get();if(!fallback)assert.equal(contact.verification_provider,'Treg');if(withPhone&&!fallback){assert.equal(contact.phone_number,'+37120000001');assert.equal(contact.phone_status,'provider_listed');if(existingEmail)assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM crm_contacts').get().n,1);}
  const delivery=await verifyAutomaticEmail(env,'w1',contact.normalized_email,{companyDomain:'example.com',confirmationLevel:'provider_verified'});assert.equal(delivery.verified,true);if(!fallback)assert.equal(delivery.provider,'Treg');
  if(fallback){const {getCrmCompany}=await import('../src/crm.js');const detail=await getCrmCompany(env.DB,{workspaceId:'w1',userId:'u1',role:'owner'},contact.company_id);const trace=detail.intelligence.research_snapshot.buyerResearch.discovery.phoneEnrichment;assert.ok(trace?.events.some(event=>event.provider==='apollo'),JSON.stringify(trace));assert.equal(trace.status,mode==='fallback_pending'?'pending':['fallback_disabled','fallback_credit_limit','fallback_webhook_missing'].includes(mode)?'failed':'unavailable');if(mode==='fallback_pending'){assert.equal(trace.events.find(e=>e.provider==='apollo').status,'requested');assert.equal(detail.phoneRequests[0].contact_id,contact.id);const {buildApolloCrmWebhookUrl,handleApolloCrmWebhook}=await import('../src/apollo-crm-webhook.js');const callbackUrl=await buildApolloCrmWebhookUrl(env.APOLLO_WEBHOOK_URL,detail.phoneRequests[0].id,env.APOLLO_WEBHOOK_SECRET);const callback=await handleApolloCrmWebhook(new Request(callbackUrl,{method:'POST',body:JSON.stringify({status:'success',credits_consumed:8,people:[{id:'anna',phone_numbers:[{sanitized_number:'+12025550142',status_cd:'valid_number'}]}]})}),env,{});assert.equal(callback.status,200);const settled=await getCrmCompany(env.DB,{workspaceId:'w1',userId:'u1',role:'owner'},contact.company_id);assert.equal(settled.contacts.find(c=>c.id===contact.id).phone_number,'+12025550142');assert.equal(settled.intelligence.research_snapshot.buyerResearch.discovery.phoneEnrichment.status,'available');assert.equal(settled.phoneRequests[0].credits_used,9);}}
  const drafted=await executeWorkflowStage('messages',{env,row:{workspace_id:'w1',approved_by:'u1'},context:approvedContext(main),config,result,guard:async()=>{}});assert.ok(drafted.candidates[0].message.body.includes('Anna'));
  assert.equal(Number(env.DB.raw.prepare('SELECT SUM(cost_micro) cost FROM treg_contact_calls').get().cost)||0,existingEmail?(withPhone?125000:0):withPhone?137000:8000);
 }finally{globalThis.fetch=original;}
});

test('updated workflow research persists every AI review signature input for a saved company',async()=>{
 const env=await fixture(),crm=await import('../src/crm.js'),context={workspaceId:'w1',userId:'u1',role:'owner'},D=globalThis.LeadIntelDiscovery;
 const saved=await crm.upsertCrmCompany(env.DB,context,{company_name:'Example',domain:'signature.example',source:'discovery'});
 await crm.upsertCrmIntelligence(env.DB,context,saved.company.id,{evidence:[{url:'https://signature.example/old',text:'Earlier evidence'}],research_snapshot:{fitDescription:'Earlier fit',buyerRoles:['CEO'],buyerRolesChanged:false}});
 const now=new Date().toISOString(),candidate={company:'Example',domain:'signature.example',fitDescription:'Updated automation opportunity',buyerRoles:['COO'],buyerRolesChanged:true,evidence:[{url:'https://signature.example/new',text:'Updated official company evidence',date:'2026-10-29'}],people:[{id:'anna',name:'Anna Buyer',title:'COO',organization:'Example'}],buyerDiscovery:{checkedAt:now,opportunityRoles:['COO']},publicResearch:{aiReview:{status:'complete',checkedAt:now,reviewedPersonIds:['anna'],findings:[],conflicts:[]}}};
 candidate.publicResearch.aiReview.inputSignature=D.buyerReviewSignature(candidate);
 assert.equal(await persistWorkflowBuyerResearch(env,context,candidate),true);
 const detail=await crm.getCrmCompany(env.DB,context,saved.company.id),s=detail.intelligence.research_snapshot,reloaded={company:detail.company.company_name,domain:detail.company.normalized_domain,fitDescription:s.fitDescription,buyerRoles:s.buyerRoles,buyerRolesChanged:s.buyerRolesChanged,buyerFit:s.buyerFit,evidence:detail.intelligence.evidence,buyerDiscovery:s.buyerResearch.discovery,people:s.buyerResearch.buyers,publicResearch:s.buyerResearch.publicResearch};
 assert.equal(D.buyerReviewSignature(reloaded),candidate.publicResearch.aiReview.inputSignature);assert.equal(detail.intelligence.evidence[0].url,'https://signature.example/new');
});
