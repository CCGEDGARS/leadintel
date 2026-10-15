const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
const app=fs.readFileSync(require.resolve('../app.js'),'utf8');
const render=app.slice(app.indexOf('function renderMarketOpportunities()'),app.indexOf('function researchRunning()'));
function setup(market={}){
 const document=new JSDOM(html).window.document;
 const state={market:{opportunities:[],researchStatus:'idle',...market}};
 const context={state,$:id=>document.getElementById(id),esc:s=>String(s),contentLanguage:()=> 'en',scoreCell:()=>'',LeadIntelMarketConditions:{normalizePack:x=>x||null}};
 vm.createContext(context);vm.runInContext(render,context);
 return {document,state,run:()=>vm.runInContext('renderMarketOpportunities()',context)};
}
const opportunity={title:'Evidence-backed opportunity',market:'Sweden',active:true,confidence:'Medium',evidence:[{url:'https://example.com/news',title:'Expansion'}],score:{total:60},hypothesis:'Possible commercial fit'};
test('idle research shows one status and action without repeating profile markets or context',()=>{
 const f=setup({opportunities:[{profileOnly:true,title:'Sweden',active:true}]});const before=JSON.stringify(f.state);f.run();
 const panel=f.document.querySelector('.research-panel');
 assert.equal(f.document.querySelector('#strategy-research-summary').textContent,'No research yet');
 assert.equal(f.document.querySelector('#strategy-research-action').textContent,'Research market →');
 assert.equal(panel.querySelectorAll('.opportunity-card').length,0);
 assert.equal(f.document.querySelector('#strategy-research-findings').hidden,true);
 assert.equal(JSON.stringify(f.state),before,'render must preserve market selection and saved context');
 assert.ok(panel.querySelector('[data-open-profile-market]'),'existing research workbench handoff retained');
});
test('findings stay collapsed, open on demand and preserve original opportunity indexes',()=>{
 const f=setup({researchStatus:'partial',opportunities:[{profileOnly:true,title:'Sweden'},opportunity]});f.run();
 const findings=f.document.querySelector('#strategy-research-findings');
 assert.equal(findings.hidden,false);assert.equal(findings.open,false);
 assert.equal(findings.querySelector('[data-opportunity-active]').dataset.opportunityActive,'1');
 assert.equal(findings.querySelector('.evidence-links a').href,'https://example.com/news');
 findings.open=true;f.run();assert.equal(findings.open,true);
 findings.open=false;f.run();assert.equal(findings.open,false);
 assert.equal(f.document.querySelector('#strategy-research-action').textContent,'Update research →');
 const reloaded=setup(JSON.parse(JSON.stringify(f.state.market)));reloaded.run();
 assert.equal(reloaded.document.querySelectorAll('.opportunity-card').length,1);
});
test('running and failed research expose a useful status and action without empty findings',()=>{
 const f=setup({researchStatus:'running'});f.run();
 assert.equal(f.document.querySelector('#strategy-research-summary').textContent,'Research in progress…');
 assert.equal(f.document.querySelector('#strategy-research-action').textContent,'View progress →');
 f.state.market.researchStatus='error';f.run();
 assert.match(f.document.querySelector('#strategy-research-summary').textContent,/try again/);
 assert.equal(f.document.querySelector('#strategy-research-findings').hidden,true);
});
test('saved reports remain accessible even when opportunity cards are absent',()=>{
 const f=setup({researchReports:[{id:'saved',sources:[]}]});f.run();
 assert.equal(f.document.querySelector('#strategy-research-findings').hidden,false);
 assert.ok(f.document.querySelector('#strategy-research-findings [data-research-reports][data-hide-empty]'));
 assert.equal(f.document.querySelector('#market-opportunities').hidden,true);
});
test('compact report host suppresses only its empty state and restores real saved reports',()=>{
 const dom=new JSDOM('<div data-research-reports data-hide-empty></div><div data-research-reports></div>');
 const previous=global.document;global.document=dom.window.document;
 try{
  const Report=require('../research-report.js');const state={market:{researchReports:[],researchReportsInitialized:true}};
  const ui=Report.install({getState:()=>state,save:()=>{},onStrategy:()=>{}});ui.render();
  const [compact,workbench]=global.document.querySelectorAll('[data-research-reports]');
  assert.equal(compact.hidden,true);assert.equal(compact.textContent,'');assert.match(workbench.textContent,/No saved reports/);
  state.market.researchReports=[{id:'saved',sources:[],createdAt:'2026-10-15',mode:'quick'}];ui.render();
  assert.equal(compact.hidden,false);assert.ok(compact.querySelector('[data-report-latest]'));
  Report.deleteSaved(state.market,null);ui.render();assert.equal(compact.hidden,true);
 }finally{global.document=previous;dom.window.close();}
});
