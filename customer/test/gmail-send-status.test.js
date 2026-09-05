const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
for(const status of ['sending','failed','sent'])test(`Gmail ${status} status is not misreported as delivery`,async()=>{
  let confirmed=0;
  const nodes={'delivery-company-select':{value:'example.com'},'delivery-recipient':{value:'buyer@example.com'},'send-with-gmail':{},'confirm-delivery-sent':{click(){confirmed++;}}};
  const window={LeadIntelServerBridge:{gmail:{connected:true},sendGmail:async()=>({ok:true,duplicate:true,message:{status}}),saveNow:async()=>{}}};
  const source=fs.readFileSync(path.join(__dirname,'../production-gmail-ui.js'),'utf8').replace('})(window);','root.sendForTest=send;})(window);');
  vm.runInNewContext(source,{window,document:{readyState:'loading',addEventListener(){},getElementById:id=>nodes[id]},localStorage:{getItem:()=>null},sessionStorage:{setItem(){}},LeadIntelOutreach:{normalizeOutreachState:()=>({items:[{domain:'example.com',approved:true,approvedAt:'2026-09-05',drafts:{}}]})},LeadIntelDelivery:{normalizeEmail:x=>x},confirm:()=>true,crypto:webcrypto,TextEncoder,setTimeout,clearTimeout});
  await window.sendForTest();assert.equal(confirmed,status==='sent'?1:0);assert.equal(nodes['send-with-gmail'].disabled,false);
});
