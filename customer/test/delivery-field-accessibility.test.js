const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
test('Delivery history and reply fields expose associated labels and instructions',()=>{
 const dom=new JSDOM('<main class="content"><section id="step-6"><div class="outreach-drafts"></div></section></main>',{url:'https://example.test/customer/',runScripts:'outside-only'}),w=dom.window;
 try{
  Object.assign(w,{LeadIntelDelivery:require('../delivery-engine.js'),LeadIntelOutreach:require('../outreach-engine.js'),LeadIntelDiscovery:require('../discovery-engine.js'),LeadIntelContentLanguage:{workspaceContentLanguage:()=> 'en'}});
  let ready=false;
  w.addEventListener('leadintel:delivery-ready',()=>{ready=Boolean(w.LeadIntelDeliveryUI?.ready&&w.document.getElementById('delivery-recipient'));});
  w.eval('(function(){'+fs.readFileSync(require.resolve('../delivery-ui.js'),'utf8').replace(/^import .*;\s*$/gm,'')+'\n})();');
  assert.equal(ready,true,'readiness is announced after the module and controls exist');
  for(const [id,label] of [['delivery-history-select','Sent email to track'],['reply-text','Customer reply']]){
   const control=w.document.getElementById(id);
   assert.ok([...control.labels].some(el=>el.textContent.trim()===label),id+' has a readable associated label');
   const description=w.document.getElementById(control.getAttribute('aria-describedby'));
   assert.ok(description?.textContent.trim(),id+' exposes its instructions');
  }
  assert.equal(w.document.querySelectorAll('#delivery-history-select').length,1);
  assert.equal(w.document.querySelectorAll('#record-reply').length,1);
 }finally{w.close();}
});
