import {createRequire} from 'node:module';
import {journeyFixture,workspaceId,sessionToken,sourceUrl} from './step5-journey-fixture.mjs';
import {encryptSecret,importAesKey} from '../src/oauth.js';

const require=createRequire(import.meta.url);
const Profile=require('../../customer/profile-engine.js');
const Canonical=require('../../customer/canonical-intelligence.js');
const Strategy=require('../../customer/strategy-integrity.js');
const Market=require('../../customer/market-engine.js');
require('../../customer/company-brain.js').install(globalThis);
require('../../customer/business-identity.js').patchProfileEngine(Profile,globalThis);
const Brand=require('../../customer/brand-identity.js');
const Studio=require('../../customer/message-studio.js');
const Editor=require('../../customer/message-editor.js');
const Outreach=require('../../customer/outreach-engine.js');
const Delivery=require('../../customer/delivery-engine.js');
const identity=require('../../customer/test/helpers/recipient-identity.cjs');
export const exactDrafts={
 robert:{subject:'Robert — exact approved delivery',message:'Hello Robert,\n\nThis is the exact reviewed delivery copy.\nThe second line stays separate.\n\nBest regards,\nRobin Lane',messageHtml:'<p>Hello Robert,</p><p>This is the <strong>exact reviewed delivery copy.</strong><br>The second line stays separate.</p><p>Best regards,<br>Robin Lane</p>'},
 alice:{subject:'Alice — separate approved delivery',message:'Hello Alice,\n\nThis is Alice’s separate reviewed delivery copy.\n\nBest regards,\nRobin Lane',messageHtml:'<p>Hello Alice,</p><p>This is Alice’s <em>separate reviewed delivery copy.</em></p><p>Best regards,<br>Robin Lane</p>'}
};

// Real sessions, all migrations, workspace CAS, CRM contact confirmation and
// production domain approval. Only outbound HTTP providers are controlled.
// These synthetic drafts are explicit manual review fixtures, not AI claims.
export async function step7Fixture({connected=true}={}){
 const providerRequests=[];let nextMode='accepted',nextGate=null;
 const f=await journeyFixture({externalFetch:async(input,options={})=>{
  const url=new URL(typeof input==='string'?input:input.url);
  if(url.hostname==='oauth2.googleapis.com'&&url.pathname==='/token')return Response.json({access_token:'controlled-access',expires_in:3600});
  if(url.hostname==='gmail.googleapis.com'||url.hostname==='www.googleapis.com'){
   if(url.pathname.endsWith('/messages/send')){
    const body=JSON.parse(options.body),request={method:options.method,url:url.href,mime:Buffer.from(body.raw,'base64url').toString('utf8'),mode:nextMode,status:'pending'};for(const [field,type] of [['textBody','plain'],['htmlBody','html']]){const match=request.mime.match(new RegExp('Content-Type: text/'+type+'; charset=UTF-8\\r\\nContent-Transfer-Encoding: base64\\r\\n\\r\\n([A-Za-z0-9+/=\\r\\n]+)'));request[field]=match?Buffer.from(match[1].replace(/\s/g,''),'base64').toString('utf8'):null;}providerRequests.push(request);
    const gate=nextGate;nextGate=null;if(gate){gate.started();await gate.wait;}
    const mode=nextMode;nextMode='accepted';request.status=mode;
    if(mode==='unknown')return Response.json({});
    if(mode==='unavailable')return Response.json({error:{message:'Controlled mailbox unavailable'}},{status:503});
    return Response.json({id:'controlled-message-'+providerRequests.length,threadId:'controlled-thread-'+providerRequests.length});
   }
   throw Error('Unplanned Gmail provider request: '+url.pathname);
  }
 }});
 try{
  Object.assign(f.env,{OAUTH_TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,23).toString('base64'),GOOGLE_OAUTH_CLIENT_ID:'fixture-client',GOOGLE_OAUTH_CLIENT_SECRET:'fixture-secret',GMAIL_OAUTH_REDIRECT_URI:f.origin+'/api/integrations/gmail/callback'});
  const token=await encryptSecret('controlled-refresh',await importAesKey(f.env.OAUTH_TOKEN_ENCRYPTION_KEY));
  if(connected)f.DB.raw.prepare('INSERT INTO gmail_connections(workspace_id,user_id,google_email,encrypted_refresh_token,scopes,status) VALUES(?,?,?,?,?,?)').run(workspaceId,'storage-owner','robin@seller.example',token,'https://www.googleapis.com/auth/gmail.send','connected');
  const batch=f.DB.batch.bind(f.DB);let tail=Promise.resolve();f.DB.batch=writes=>{const operation=tail.then(()=>batch(writes));tail=operation.catch(()=>{});return operation;};
  const saved=await f.getState();let main=saved.payload.main;
  main.answers={...main.answers,buying_outcomes:'production flow downtime',value_proposition:'simplify production flow',differentiation:'Our team supports industrial projects.',proof_points:'No approved proof yet',objections:'Unknown',delivery_approach:'Project-specific engineering and installation.',meeting_value:'relevant project lessons'};
  main.answerStatus=Object.fromEntries(Object.keys(main.answers).map(key=>[key,'user']));
  main.brandIdentity={senderName:'Robin Lane',senderTitle:'Commercial Director',companyDisplayName:'Fixture Industrial',website:'https://seller.example',email:'robin@seller.example'};
  main.messageStudio={};main.profile=Profile.buildCompanyIntelligenceProfile(main);
  main={...main,...Profile.normalizeSavedState(main),market:Market.normalizeMarketState(main.market),brandIdentity:Brand.normalize(main.brandIdentity),senderIdentityVersion:1};
  // Approve the canonical projection used by browser restore, including the
  // customer outcomes already confirmed in answers, before capturing authority.
  main.profile=Canonical.normalizeCanonicalProfile(main.profile,main);
  Canonical.confirmProfileContext(main);main.approved=true;main.market.strategyApproved=true;main.market.strategyApproval=Strategy.approval(main);main.step=7;
  const contacts=[];
  for(const person of f.candidate.people){
   const response=await fetch(f.origin+'/api/crm/companies/'+f.candidate.crmId+'/confirm-public-email?workspace_id='+workspaceId,{method:'POST',headers:{Cookie:'leadintel_session='+sessionToken,'Content-Type':'application/json'},body:JSON.stringify({name:person.publicName||person.name,title:person.title,person_id:person.id,email:person.publicEmail,source_url:sourceUrl})});
   if(!response.ok)throw Error('Step 7 official contact fixture failed: '+await response.text());contacts.push((await response.json()).contact);
  }
  const company={...saved.payload.discovery.selectedProspects[0],stage:'Ready for Outreach'};
  company.people=company.people.map(person=>({...person,email:person.publicEmail,contactId:contacts.find(contact=>contact.external_person_id===person.id).id,company:company.company,companyDomain:company.domain}));
  const studio=Studio.storageState(Studio.foundation(Studio.normalize({mode:'professional',essentials:{sender:'Robin Lane',senderRole:'Commercial Director',company:'Fixture Industrial',offer:'industrial automation',target:'manufacturers',problem:'production flow downtime',value:'simplify production flow',difference:'Our team supports industrial projects.',meetingValue:'relevant project lessons',calendly:'https://calendly.com/fixture/intro'}}),main));
  const items=company.people.map(person=>{
   const copy=exactDrafts[person.id];let item=Editor.apply({domain:company.domain,company:company.company,channel:'email',selectedPersonId:person.id,drafts:{},dossier:{domain:company.domain,company:company.company,people:company.people,evidence:company.evidence}},copy,{origin:'manual',style:'professional',essentials:Studio.foundation(studio,main).essentials});
   Object.assign(item,{campaignScenario:{language:'en',resolvedLanguage:'en'},localizationStatus:'complete',localizationApprovalBlocked:false,localizationProvenance:{provider:'synthetic-manual-review',model:'fixture-v1',language:'en',selectionSource:'manual'}});
   item.messageStudioDraft.recipientIdentity=identity(company,person,company.crmId);item.messageStudioDraft.scriptSavedAt=new Date().toISOString();item.messageStudioDraft.savedDraft=copy;
   item=Outreach.normalizeOutreachState({items:[item]}).items[0];
   item=Outreach.approveOutreachItem(item,item.drafts,new Date().toISOString(),{canonicalState:main,canonicalStudio:studio});
   if(!Outreach.approvalCurrent(item)||!Outreach.sourceAuthorityCurrent(item,main,studio))throw Error('Step 7 fixture approval invalid: '+item.error);
   return item;
  });
  const outreach={selectedDomain:company.domain,items,messageStudio:studio};
  const payload={...saved.payload,main,discovery:{...saved.payload.discovery,selectedProspects:[company],pipeline:[company]},outreach,delivery:{selectedDomain:company.domain,selectedPackageKey:Delivery.packageKey(items[0])},meta:{...saved.payload.meta,discovery:{...saved.payload.meta.discovery,activeJourneyStage:7,visibleStep:7,pipelineWebsite:main.website,scriptBuyer:{workspaceId,domain:company.domain,personId:'robert',channel:'email',recipientIdentity:items[0].messageStudioDraft.recipientIdentity}}}};
  await f.replace(payload,saved.version);
  return {...f,items,contacts,providerRequests,setNextProvider(mode){nextMode=mode;},holdNextProvider(){let started,release;const began=new Promise(resolve=>started=resolve),wait=new Promise(resolve=>release=resolve);nextGate={started,wait};return {began,release};},failCrm(){f.DB.raw.exec("CREATE TRIGGER step7_crm_outage BEFORE INSERT ON crm_activities BEGIN SELECT RAISE(ABORT,'controlled CRM outage'); END");},restoreCrm(){f.DB.raw.exec('DROP TRIGGER IF EXISTS step7_crm_outage');}};
 }catch(error){await f.close();throw error;}
}
