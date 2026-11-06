const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {mounted}=require('./helpers/message-runtime.js');const tick=()=>new Promise(r=>setImmediate(r));
function setup(){return mounted({selected:'professional',runtimeSetup:fs.readFileSync(require.resolve('../channel-scripts.js'),'utf8')+`\nLeadIntelServerBridge.session.user.id='user';handoffContact.contact.id='contact';handoffContact.contact.company_id='company';installChannelScripts();`});}
for(const protectedCopy of [false,true])test('opening a saved buyer consults the owner master with missing meeting fields and '+(protectedCopy?'preserves manual work':'replaces only untouched generated text'),async()=>{
 const h=setup();try{
 h.w.eval(`const selected=studioState();selected.mode='storyselling';selected.essentials.calendly='';persistStudio(selected);const old=currentItem();old.messageStudioDraft={...old.messageStudioDraft,mode:'storyselling',editorOrigin:'${protectedCopy?'manual':'template'}',scriptSavedAt:null};delete old.messageStudioDraft.channelLibrarySource;upsertItem(old);renderAll();`);
 const before=h.item().drafts.emailBody;
 h.requests.find(r=>String(r.url).includes('/script-library?')).resolve({ok:true,json:async()=>({core:[{id:'email:storyselling',channel:'email',style:'storyselling',name:'Storyselling',subject:'Case reference',body:'Exact saved story for {{firstName}}. [Booking link]',builtin:false,creatorSource:{id:'owner',revision:1}}],personal:[],primary:[],canManage:false})});await tick();
 h.w.automaticallyPrepareMessage();await tick();await tick();
 assert.equal(h.item().drafts.emailBody,protectedCopy?before:'Exact saved story for Alex. [Booking link]');
 if(!protectedCopy){assert.equal(h.item().messageStudioDraft.channelLibrarySource,'email:storyselling');assert.equal(h.item().messageStudioDraft.templateUpdateUndo.draft.message,before);h.w.automaticallyPrepareMessage();await tick();assert.equal(h.item().drafts.emailBody,'Exact saved story for Alex. [Booking link]');}
 assert.equal(h.requests.some(r=>/send|enqueue|ai\/generate/.test(String(r.url))),false);
 }finally{h.w.close();}
});
