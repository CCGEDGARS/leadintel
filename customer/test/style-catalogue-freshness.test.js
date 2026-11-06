const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {mounted}=require('./helpers/message-runtime.js');
const tick=()=>new Promise(r=>setImmediate(r));
for(const failed of [false,true])test('style click revalidates a cached builtin and '+(failed?'preserves the draft on failure':'uses the newly activated master'),async()=>{
 const h=mounted({selected:'professional',runtimeSetup:fs.readFileSync(require.resolve('../channel-scripts.js'),'utf8')+`\nLeadIntelServerBridge.session.user.id='user';handoffContact.contact.id='contact';handoffContact.contact.company_id='company';installChannelScripts();`});
 try{
 h.w.LeadIntelStorysellingNative=require('../storyselling-native.js');
 h.requests.find(r=>String(r.url).includes('/script-library?')).resolve({ok:true,json:async()=>({core:require('../storyselling-native.js').seeds,personal:[],primary:[],canManage:false})});
 await tick();const original=h.item().drafts.emailBody;
 h.w.document.querySelector('[data-writing-style="storyselling"]').click();await tick();
 const calls=h.requests.filter(r=>String(r.url).includes('/script-library?'));assert.equal(calls.length,2);
 assert.equal(h.item().drafts.emailBody,original);
 calls[1].resolve(failed?{ok:false,json:async()=>({error:'Unavailable'})}:{ok:true,json:async()=>({core:[{id:'email:storyselling',channel:'email',style:'storyselling',name:'Storyselling',subject:'Saved case',body:'Last [spring], our customer called. Exact owner words.',builtin:false,creatorSource:{id:'owner',revision:2}}],personal:[],primary:[],canManage:false})});
 await tick();await tick();
 assert.equal(h.item().drafts.emailBody,failed?original:'Last [spring], our customer called. Exact owner words.');
 if(failed)assert.equal(h.w.LeadIntelChannelWorkspace.styleFeedback().state,'failed');
 else assert.equal(h.item().messageStudioDraft.templateUpdateUndo.draft.message,original);
 }finally{h.w.close();}
});
