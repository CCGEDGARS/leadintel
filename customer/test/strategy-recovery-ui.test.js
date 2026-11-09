const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const source=fs.readFileSync(require.resolve('../app.js'),'utf8'),html=fs.readFileSync(require.resolve('../index.html'),'utf8');
const render=source.slice(source.indexOf('function renderStrategyRecovery('),source.indexOf('function checkStrategyLocalPersistence('));
test('an earlier recovery copy stays available behind a closed disclosure and does not imply a current cloud-save failure',()=>{
 const w=new JSDOM(html,{runScripts:'outside-only'}).window,record={version:2,local:{draft:'retained'},saved:{draft:'other'}};let current=record;
 try{w.$=id=>w.document.getElementById(id);w.strategyRecoveryRecord=()=>current;w.eval(render);const details=w.$('strategy-recovery-details'),button=w.$('download-strategy-recovery');
  w.renderStrategyRecovery();assert.equal(details.hidden,false);assert.equal(details.open,false);assert.equal(button.hidden,false);assert.ok(details.contains(button));assert.match(details.textContent,/does not indicate a current cloud-save failure/);
  w.__leadIntelLocalStrategyConflict=true;w.renderStrategyRecovery();assert.equal(details.open,true,'An active editing conflict exposes the existing recovery action');assert.equal(record.local.draft,'retained');
  current=null;w.renderStrategyRecovery();assert.equal(details.hidden,true);assert.equal(button.hidden,true,'Recovery from a different account remains inaccessible');
 }finally{w.close();}
});
