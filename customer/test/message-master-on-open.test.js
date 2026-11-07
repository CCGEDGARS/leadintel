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
for(const changed of [false,true])test('an existing raw bracket master is personalized on reopen while manual alterations are preserved: '+changed,async()=>{
 const h=setup();try{
 const row={id:'email:professional',channel:'email',style:'professional',name:'Professional',subject:'[First name]. [Company]',body:'Hi [First name],\n\n[Your name] from [Company]. [result]',creatorSource:{id:'owner',revision:1}};
 h.w.upsertItem({...h.item(),drafts:{...h.item().drafts,emailSubject:row.subject,emailBody:row.body+(changed?'\nMy manual addition':'')},messageStudioDraft:{mode:'professional',editorOrigin:'manual',channelLibrarySource:row.id}});h.w.renderAll();
 h.requests.find(r=>String(r.url).includes('/script-library?')).resolve({ok:true,json:async()=>({core:[row],personal:[],primary:[],canManage:false})});await tick();h.w.automaticallyPrepareMessage();await tick();await tick();
 assert.equal(h.item().drafts.emailBody,changed?row.body+'\nMy manual addition':'Hi Alex,\n\nRobin Lane from North Works. [result]');
 if(!changed){assert.equal(h.item().drafts.emailSubject,'Alex. North Works');assert.match(h.q('mw-updating-notice').textContent,/Needs information: result/);assert.equal(h.q('mw-add-flow').disabled,true);assert.equal(h.q('mw-save-message').disabled,false);}
 }finally{h.w.close();}
});
for(const manual of [false,true])test('partially filled owner master repairs known remaining fields without replacing manual wording: '+manual,async()=>{
 const h=setup();try{
 const row={id:'email:professional',channel:'email',style:'professional',subject:'[First name]. [Company]',body:'Hi [First name],\n\n[Your full name] from [Company]. [result]',creatorSource:{id:'owner',revision:1}};
 const body='Hi Alex,\n\n[Your full name] from North Works. [result]'+(manual?'\nKeep this note.':'');
 h.w.upsertItem({...h.item(),drafts:{...h.item().drafts,emailSubject:'Alex. North Works',emailBody:body},messageStudioDraft:{mode:'professional',editorOrigin:'manual',channelLibrarySource:row.id}});h.w.renderAll();
 h.requests.find(r=>String(r.url).includes('/script-library?')).resolve({ok:true,json:async()=>({core:[row],personal:[],primary:[],canManage:false})});await tick();h.w.automaticallyPrepareMessage();await tick();await tick();
 assert.equal(h.item().drafts.emailBody,manual?body:'Hi Alex,\n\nRobin Lane from North Works. [result]');
 if(!manual)assert.equal(h.item().messageStudioDraft.templateUpdateUndo.draft.message,body);
 }finally{h.w.close();}
});
test('many unresolved slots do not cause ambiguous matching when a manual note follows',async()=>{
 const h=setup();try{
 const row={id:'email:professional',channel:'email',style:'professional',subject:'[First name]',body:'Hi [First name], '+Array.from({length:40},(_,i)=>'[Unknown fact '+i+']').join(' '),creatorSource:{id:'owner',revision:1}};
 const body=row.body.replace('[First name]','Alex')+' Manual note.';
 h.w.upsertItem({...h.item(),drafts:{...h.item().drafts,emailSubject:'Alex',emailBody:body},messageStudioDraft:{mode:'professional',editorOrigin:'manual',channelLibrarySource:row.id}});h.w.renderAll();
 h.requests.find(r=>String(r.url).includes('/script-library?')).resolve({ok:true,json:async()=>({core:[row],personal:[],primary:[],canManage:false})});await tick();h.w.automaticallyPrepareMessage();await tick();await tick();assert.equal(h.item().drafts.emailBody,body);
 }finally{h.w.close();}
});
