import test from 'node:test';
import assert from 'node:assert/strict';
import {runDeterministicDiagnostics,persistDiagnosticSnapshot} from '../src/copilot-diagnostics.js';

function base(overrides={}){
  return {
    workspace:{id:'w1'},screen:{step:1,label:'Company & Market'},
    company:{name:'Acme',website:'https://acme.example',description:'Industrial systems'},markets:['Latvia'],
    profile:{buyer_roles:'Procurement Director',exclusions:'Consumer projects',opportunity_value:'€50k–€250k'},
    icps:[{id:'i1',name:'Manufacturers',criteria:'50–500 employees'}],
    signals:[{id:'s1',name:'Factory expansion',description:'New factory capacity expansion investment',active:true,weight:80,keywords:['factory expansion','new plant']}],
    research:{items:[{name:'Market evidence',summary:'Factory investment announced',sourceUrl:'https://news.example'}],count:1},
    discoverySummary:{companyCount:0},crmSummary:{total:0,active:0,customers:0,pipeline:[],topCompanies:[]},
    outreachSummary:{mode:'manual',draftCount:0,sent:0,replies:0,meetings:0},integrationStatus:[],
    readiness:{percent:100},...overrides
  };
}
function has(diags,{category,severity,match}){return diags.some(item=>(!category||item.category===category)&&(!severity||item.severity===severity)&&(!match||new RegExp(match,'i').test(`${item.title} ${item.summary}`)));}

test('missing website creates an Important completeness diagnostic with stable fingerprint',()=>{
  const a=runDeterministicDiagnostics(base({company:{name:'Acme',website:'',description:'x'}}));
  const b=runDeterministicDiagnostics(base({company:{name:'Acme',website:'',description:'changed'}}));
  assert.ok(has(a,{category:'completeness',severity:'important',match:'website'}));
  const first=a.find(item=>/website/i.test(item.title+item.summary));const second=b.find(item=>item.fingerprint===first.fingerprint);assert.ok(second);
});

test('missing target market creates Important readiness issue',()=>{
  const diagnostics=runDeterministicDiagnostics(base({markets:[]}));
  assert.ok(has(diagnostics,{category:'readiness',severity:'important',match:'market'}));
});

test('profile without ICP or active signals creates Improve diagnostics but valid Step 1 has no false Important',()=>{
  let diagnostics=runDeterministicDiagnostics(base({icps:[],signals:[]}));
  assert.ok(has(diagnostics,{severity:'improve',match:'ICP|ideal customer'}));
  assert.ok(has(diagnostics,{severity:'improve',match:'signal|trigger'}));
  diagnostics=runDeterministicDiagnostics(base());
  assert.equal(diagnostics.some(item=>item.severity==='important'),false);
});

test('generic signals without useful keywords are flagged for quality',()=>{
  const diagnostics=runDeterministicDiagnostics(base({signals:[{id:'s1',name:'Growth',description:'Growth',active:true,weight:70,keywords:[]}]}));
  assert.ok(has(diagnostics,{category:'quality',severity:'improve',match:'signal|keyword|generic'}));
});

test('missing buyer roles, exclusions and opportunity value create completeness guidance',()=>{
  const diagnostics=runDeterministicDiagnostics(base({profile:{}}));
  for(const phrase of ['buyer','exclusion','value'])assert.ok(has(diagnostics,{category:'completeness',severity:'improve',match:phrase}),phrase);
});

test('Discovery without market evidence gets Improve evidence diagnostic',()=>{
  const diagnostics=runDeterministicDiagnostics(base({screen:{step:5,label:'Discovery'},research:{items:[],count:0}}));
  assert.ok(has(diagnostics,{category:'evidence',severity:'improve',match:'research|evidence'}));
});

test('integration gaps are contextual rather than globally Important',()=>{
  let diagnostics=runDeterministicDiagnostics(base({screen:{step:1,label:'Company & Market'},integrationStatus:[]}));
  assert.equal(diagnostics.some(item=>item.severity==='important'&&/gmail|apollo|firecrawl/i.test(item.title+item.summary)),false);
  diagnostics=runDeterministicDiagnostics(base({screen:{step:7,label:'Delivery & Learning'},integrationStatus:[{provider:'gmail',state:'disconnected'}]}));
  assert.ok(has(diagnostics,{severity:'improve',match:'gmail'}));
});

test('persistDiagnosticSnapshot upserts current fingerprints and resolves stale open diagnostics',async()=>{
  const calls=[];const env={DB:{prepare(sql){return {bind(...args){calls.push({sql,args});return this;},async run(){return {meta:{changes:1}};},async all(){return {results:[{fingerprint:'stale-one',status:'open'}]};}};}}};
  const diagnostics=runDeterministicDiagnostics(base({markets:[]}));
  const result=await persistDiagnosticSnapshot(env,{workspaceId:'w1',diagnostics});
  assert.equal(result.saved,diagnostics.length);assert.ok(calls.some(call=>/INSERT INTO copilot_diagnostics/i.test(call.sql)));
  assert.ok(calls.some(call=>/status='resolved'/i.test(call.sql)&&call.args.includes('stale-one')));
});
