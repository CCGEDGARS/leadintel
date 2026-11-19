import test from 'node:test';
import assert from 'node:assert/strict';
import {journeyFixture,workspaceId,sessionToken} from './step5-journey-fixture.mjs';
import {buildCopilotWorkspaceContext} from '../src/copilot-context.js';
import {workspaceQuestionTopic,workspaceFactAnswer} from '../src/copilot-grounding.js';
import {runCopilotTurn} from '../src/copilot-service.js';

test('scoped saved facts survive stale history, changes, failed reads and unconnected AI without provider spend',async()=>{
  const f=await journeyFixture({durableCopilot:true});let spent=0;
  f.env.COPILOT_TEST_PROVIDER={generate:async()=>{spent++;throw Error('Unexpected model call');},search:async()=>{spent++;throw Error('Unexpected search');}};
  try{
    let state=await f.getState();
    state.payload.main.answers.buying_triggers='Nine profile descriptions: one; two; three; four; five; six; seven; eight; nine.';
    state.payload.main.market.signals=[{id:'tender',name:'Tender or procurement activity',active:true,weight:9},{id:'hiring',name:'Hiring',active:false,weight:7},{id:'deleted',name:'Removed expansion',active:true,weight:10}];
    state.payload.main.market.deletedSignalIds=['deleted'];
    state.payload.main.market.icps=[{id:'core',name:'Core',active:false},{id:'lookalike',name:'Lookalike',active:true}];
    await f.replace(state.payload,state.version);
    f.DB.raw.prepare('INSERT INTO workspace_ai_integrations(workspace_id,provider,encrypted_api_key,key_hint,model,active) VALUES(?,?,?,?,?,?)').run(workspaceId,'anthropic','SECRET_TEST_ONLY','HIDDEN','claude-controlled',1);
    f.DB.raw.prepare('INSERT INTO workspace_ai_integrations(workspace_id,provider,encrypted_api_key,key_hint,model,active) VALUES(?,?,?,?,?,?)').run(workspaceId,'gemini','SECRET_TEST_ONLY','HIDDEN','gemini-controlled',0);
    f.DB.raw.prepare('INSERT INTO workspace_research_settings(workspace_id,primary_provider,secondary_provider) VALUES(?,?,?)').run(workspaceId,'anthropic','gemini');
    async function ask(message,extra={}){const response=await fetch(f.origin+'/api/copilot/chat?workspace_id='+workspaceId,{method:'POST',headers:{Cookie:'leadintel_session='+sessionToken,'Content-Type':'application/json'},body:JSON.stringify({message,...extra})});assert.equal(response.status,200,await response.clone().text());return response.json();}
    const first=await ask('How many active signals do I have?',{research_mode:'thorough',screen:{step:4,saveState:{status:'unsaved',version:0},signals:Array.from({length:9},()=>({active:true}))}});
    assert.match(first.answer,/1 active signal, 1 switched off, and 1 removed/);assert.match(first.answer,/weight 9\/10/);assert.doesNotMatch(first.answer,/Removed expansion/);
    assert.match(first.answer,/unsaved|sync conflict/);assert.match(first.answer,/versions differ/);assert.equal(first.model_calls,0);assert.equal(first.search_calls,0);
    const providers=await ask('Which providers are connected and what is my main engine?');
    assert.match(providers.answer,/Claude — connected; main engine/);assert.match(providers.answer,/Gemini — connected; additional AI provider/);assert.doesNotMatch(JSON.stringify(providers),/SECRET_TEST_ONLY|HIDDEN/);
    state=await f.getState();state.payload.main.market.signals.find(x=>x.id==='hiring').active=true;await f.replace(state.payload,state.version);
    const next=await ask('How many active signals do I have?',{conversation_id:first.conversation_id});
    assert.match(next.answer,/2 active signals, 0 switched off/);assert.ok(next.grounding.workspace_version>first.grounding.workspace_version);
    const history=await fetch(f.origin+'/api/copilot/conversations/'+first.conversation_id+'?workspace_id='+workspaceId,{headers:{Cookie:'leadintel_session='+sessionToken}}).then(r=>r.json());
    const answers=history.messages.filter(x=>x.role==='assistant');assert.equal(answers.length,2);assert.equal(answers[0].metadata.grounding.workspace_version,first.grounding.workspace_version);assert.equal(answers[1].metadata.grounding.workspace_version,next.grounding.workspace_version);
    assert.equal(f.DB.raw.prepare('SELECT COUNT(*) n FROM copilot_research_jobs').get().n,0);assert.equal(f.DB.raw.prepare('SELECT COUNT(*) n FROM copilot_research_tasks').get().n,0);assert.equal(spent,0);
    const denied=await fetch(f.origin+'/api/copilot/chat?workspace_id=foreign-workspace',{method:'POST',headers:{Cookie:'leadintel_session='+sessionToken,'Content-Type':'application/json'},body:JSON.stringify({message:'How many active signals do I have?'})});assert.equal(denied.status,403);
    const failingEnv={...f.env,DB:{prepare(sql){if(/FROM crm_companies|FROM workspace_ai_integrations/.test(sql))throw Error('PRIVATE DATABASE FAILURE');return f.DB.prepare(sql);}}};
    const partial=await buildCopilotWorkspaceContext(failingEnv,{workspaceId});
    assert.equal(partial.crmSummary.total,null);assert.ok(partial.snapshot.unavailable.includes('crm'));assert.ok(partial.snapshot.unavailable.includes('integrations'));
    assert.match(workspaceFactAnswer('How many companies are in my CRM?',partial).answer,/could not be read/);assert.match(workspaceFactAnswer('Which providers are connected?',partial).answer,/cannot confirm/);assert.doesNotMatch(JSON.stringify(partial),/PRIVATE DATABASE/);
    const broken=await runCopilotTurn({...f.env,DB:{prepare(){throw Error('PRIVATE STATE ERROR');}}},{workspaceId,question:'How many active signals do I have?'});
    assert.match(broken.answer,/cannot safely load/);assert.doesNotMatch(broken.answer,/0 active|PRIVATE STATE/);
  }finally{await f.close();}
});

test('exact totals are independent of bounded details and named companies beyond the top ten are retrievable',async()=>{
  const f=await journeyFixture();
  try{
    const state=await f.getState();
    state.payload.main.market.signals=Array.from({length:27},(_,i)=>({id:'custom-'+i,name:'Signal '+i,active:i%2===0,weight:9}));
    state.payload.main.market.opportunities=Array.from({length:18},(_,i)=>({name:'Evidence '+i}));
    state.payload.discovery.candidates=Array.from({length:30},(_,i)=>({company:'Special company '+i,domain:'company'+i+'.example',qualification:{score:90-i},score:{total:80-i}}));
    await f.replace(state.payload,state.version);
    const context=await buildCopilotWorkspaceContext(f.env,{workspaceId,question:'Explain my score for Special company 29'});
    assert.equal(context.counts.signals.total,27);assert.equal(context.counts.signals.active,14);assert.equal(context.counts.signals.off,13);assert.equal(context.counts.signals.omitted,7);assert.equal(context.research.count,18);assert.equal(context.research.items.length,12);
    assert.equal(context.discoverySummary.companyScores[0].name,'Special company 29');assert.equal(context.discoverySummary.detailsOmitted,21);
    const direct=workspaceFactAnswer('How many active signals do I have?',context);assert.match(direct.answer,/14 active signals/);assert.match(direct.answer,/7 additional records/);
  }finally{await f.close();}
});

test('external answers retain evidence kinds and reject unsupported references before being shown',async()=>{
  let calls=0;const deltas=[];
  const result=await runCopilotTurn({COPILOT_TEST_CONTEXT:{company:{},screen:{step:1}},COPILOT_TEST_MEMORIES:[],COPILOT_TEST_PROVIDER:{
    search:async()=>({web_search:true,provider:'controlled',results:[{title:'Official report',url:'https://official.example/report',description:'Published report',date:'2026-11-19',evidenceKind:'page_extract'},{title:'Bad',url:'https://secret@bad.example/private'}]}),
    generate:async({onDelta})=>{calls++;const text=JSON.stringify(calls===1?{research_query:'',answer:'Premature unverified https://invented.example/fact'}:{answer:'Source [1] was returned. Claim [2] https://invented.example/fact'});onDelta?.(text);return {text};}
  }},{workspaceId:'w1',question:'Find current public market facts',onDelta:delta=>deltas.push(delta)});
  assert.equal(result.sources.length,1);assert.equal(result.sources[0].evidenceKind,'page_extract');assert.match(result.answer,/\[1\]/);assert.match(result.answer,/unverified source/);assert.match(result.answer,/unverified link/);assert.doesNotMatch(result.answer,/invented.example/);assert.ok(!JSON.stringify(deltas).includes('invented.example'));
  assert.equal(workspaceQuestionTopic('What is current OpenAI pricing?'),'');assert.equal(workspaceQuestionTopic('How many OpenAI credits do I have?'),'');assert.equal(workspaceQuestionTopic('Research public buying signals for manufacturers'), '');assert.equal(workspaceQuestionTopic('Why did my market research fail?'),'research');
});

test('opening a different saved Flow changes the authoritative facts, and research outcomes stay separate from reports',async()=>{
  const f=await journeyFixture({durableCopilot:true});
  try{
    async function post(path,body){const response=await fetch(f.origin+path+'?workspace_id='+workspaceId,{method:'POST',headers:{Cookie:'leadintel_session='+sessionToken,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(response.status,200,await response.clone().text());return response.json();}
    let state=await f.getState();
    const first=await post('/api/flows',{action:'create',name:'Manufacturing Flow',workspaceVersion:state.version});
    state=await f.getState();state.payload.main.market.signals.push({id:'custom-hiring',name:'Hiring',weight:7,active:true});
    state.payload.main.market.researchStatus='partial';state.payload.main.market.researchResults=[{url:'https://official.example/news'}];
    state.payload.main.market.researchReports=[{id:'report-one',mode:'deep',status:'partial',sources:[],createdAt:'2026-11-19T10:00:00Z'}];
    state.payload.main.market.researchVerification={provider:'gemini',status:'error'};
    state.payload.main.market.researchErrors=[{provider:'Gemini',message:'Request failed (429) PRIVATE RAW ERROR'}];
    await f.replace(state.payload,state.version);state=await f.getState();
    const second=await post('/api/flows',{action:'create',name:'Expansion Flow',workspaceVersion:state.version});
    for(const [flow,expected] of [[first,1],[second,2]]){
      state=await f.getState();const row=f.DB.raw.prepare('SELECT revision FROM saved_flows WHERE id=?').get(flow.id);
      await post('/api/flows/'+flow.id,{action:'open',revision:row.revision,workspaceVersion:state.version});
      const current=await buildCopilotWorkspaceContext(f.env,{workspaceId});
      assert.equal(current.flow.selectedId,flow.id);assert.equal(current.counts.signals.active,expected);
      assert.match(workspaceFactAnswer('Which Flow is selected?',current).answer,new RegExp(expected===1?'Manufacturing Flow':'Expansion Flow'));
      if(expected===2){assert.equal(current.research.sourceCount,1);assert.equal(current.research.reports.count,1);assert.equal(current.research.verification.status,'error');assert.deepEqual(current.research.errors,[{provider:'Gemini',category:'rate_limit'}]);assert.doesNotMatch(JSON.stringify(current),/PRIVATE RAW ERROR/);assert.match(workspaceFactAnswer('What is my saved research status?',current).answer,/Verification status: error/);}
    }
  }finally{await f.close();}
});
