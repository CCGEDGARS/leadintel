import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSourceUrl,normalizeSourceInput,gradeAccessAudit,inferExtractableData,buildMandatorySourceQueries} from '../src/intelligence-sources-engine.js';

test('source URL validation accepts public http(s) and rejects obvious private targets',()=>{
  assert.equal(validateSourceUrl('https://www.firmas.lv/').ok,true);
  for(const value of ['http://localhost:8787/x','http://127.0.0.1/x','http://10.0.0.4/x','http://192.168.1.3/x','http://172.20.0.2/x','http://169.254.1.1/x','http://printer.local/x','ftp://example.com/x']){
    assert.equal(validateSourceUrl(value).ok,false,value);
  }
});

test('normalization keeps supported auth/cadence/status vocabulary and never accepts mandatory before useful access',()=>{
  const source=normalizeSourceInput({name:'Firmas',url:'https://firmas.lv',source_type:'registries',geography:['Latvia'],auth_mode:'google',frequency:'daily',mandatory:true,monitoring_enabled:true,access_status:'not_tested',trigger_ids:['signal-growth']});
  assert.equal(source.host,'firmas.lv');
  assert.equal(source.authMode,'google');
  assert.equal(source.frequency,'daily');
  assert.equal(source.mandatory,false);
  assert.deepEqual(source.triggerIds,['signal-growth']);
});

test('access grading distinguishes full, partial and no access from actual extracted content',()=>{
  assert.equal(gradeAccessAudit({ok:false,error:'blocked'}).status,'no_access');
  assert.equal(gradeAccessAudit({ok:true,text:'Sign in with Google to continue. '+('x'.repeat(2000))}).status,'partial');
  assert.equal(gradeAccessAudit({ok:true,text:'Company registry information annual report management board legal address revenue employees projects contacts '+('business information '.repeat(120))}).status,'full');
  assert.equal(gradeAccessAudit({ok:true,text:'Short useful page'}).status,'partial');
});

test('extractable-data inference returns concrete observed categories',()=>{
  const fields=inferExtractableData('Company registration number legal address board directors annual report revenue employees vacancies construction project procurement tender phone email news');
  for(const expected of ['company_identity','legal_registry','leadership','financials','workforce','jobs','projects','procurement','contacts','news'])assert.ok(fields.includes(expected),expected);
});

test('mandatory sources create host-scoped queries from their own mapped active signals',()=>{
  const queries=buildMandatorySourceQueries([
    {id:'SRC-1',host:'bis.gov.lv',url:'https://bis.gov.lv/',name:'BIS',mandatory:true,monitoringEnabled:true,accessStatus:'full',frequency:'daily',triggerIds:['signal-construction']},
    {id:'SRC-2',host:'firmas.lv',url:'https://firmas.lv/',name:'Firmas',mandatory:true,monitoringEnabled:true,accessStatus:'partial',frequency:'daily',triggerIds:['signal-growth']}
  ],[
    {id:'signal-construction',name:'New construction project',keywords:'building permit; construction project',active:true},
    {id:'signal-growth',name:'Company growth',keywords:'revenue growth; employee growth',active:true},
    {id:'signal-ignore',name:'Ignore',keywords:'ignore me',active:false}
  ],{targetMarkets:'Latvia',priorityOffers:'Industrial services'});
  assert.equal(queries.length,2);
  assert.match(queries[0].query,/site:bis\.gov\.lv/);
  assert.match(queries[0].query,/building permit/);
  assert.deepEqual(queries[0].signalIds,['signal-construction']);
  assert.match(queries[1].query,/site:firmas\.lv/);
  assert.deepEqual(queries[1].signalIds,['signal-growth']);
});