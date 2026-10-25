const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const file=require('node:path').join(__dirname,'../message-draft-history.js');
const H=fs.existsSync(file)?require(file):{};
const scope={workspaceId:'w1',userId:'u1',domain:'buyer.test',personId:'p1',channel:'email',language:'en'};
function storage(){const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};}
const draft={subject:'  Exact subject  ',message:'Hi Alex,\n\nI am Kaspars Mazurs.  ',messageHtml:'<div>Hi Alex,</div><div><br></div><div>I am <strong>Kaspars Mazurs.</strong>  </div>'};
test('recovery journal survives reload with exact text, formatting and sender; isolates every context',()=>{
 assert.equal(typeof H.createJournal,'function','recovery journal must be available');
 const store=storage(),j=H.createJournal(store);assert.equal(j.record(scope,{...draft,sender:'Kaspars Mazurs',style:'friendly'},{recoverable:true}),true);
 const restored=H.createJournal(store).list(scope);assert.equal(restored.length,1);assert.equal(restored[0].message,draft.message);assert.equal(restored[0].subject,draft.subject);assert.match(restored[0].messageHtml,/<strong>Kaspars Mazurs/);assert.equal(restored[0].sender,'Kaspars Mazurs');
 for(const [key,value] of Object.entries({workspaceId:'w2',userId:'u2',domain:'other.test',personId:'p2',channel:'linkedin',language:'lv'}))assert.equal(j.list({...scope,[key]:value}).length,0);
});
test('journal keeps displaced edits, deduplicates, bounds checkpoints and reports quota failure',()=>{
 assert.equal(typeof H.createJournal,'function');const j=H.createJournal(storage());
 j.record(scope,{...draft,sender:'Kaspars Mazurs'},{recoverable:true});j.record(scope,{...draft,sender:'Kaspars Mazurs'},{recoverable:false,label:'Saved to CRM'});
 assert.equal(j.list(scope).length,1);assert.equal(j.list(scope)[0].recoverable,false);
 for(let i=0;i<35;i++)j.record(scope,{...draft,message:'Version '+i});assert.equal(j.list(scope).length,20);assert.equal(j.list(scope)[0].message,'Version 34');
 const broken=H.createJournal({getItem:()=>null,setItem(){throw Error('quota')}});assert.equal(broken.record(scope,draft),false);assert.equal(j.record({...scope,userId:''},draft),false);
});
test('saved CRM versions filter company, buyer, channel and language, and exclude approval authority',()=>{
 assert.equal(typeof H.fromActivity,'function');const item={domain:'buyer.test',selectedPersonId:'p1',channel:'email',drafts:{emailSubject:draft.subject,emailBody:draft.message,emailBodyHtml:draft.messageHtml},approved:true,messageStudioDraft:{essentials:{sender:'Kaspars Mazurs'},mode:'friendly'}};
 const activity={id:'a1',occurred_at:'2026-10-25T09:00:00Z',metadata:{script_package:{version:1,item}}};
 const row=H.fromActivity(activity,scope);assert.equal(row.message,draft.message);assert.equal(row.sender,'Kaspars Mazurs');assert.equal(row.approved,undefined);
 for(const change of [{domain:'else.test'},{personId:'p2'},{channel:'linkedin'},{language:'lv'}])assert.equal(H.fromActivity(activity,{...scope,...change}),null);
});
function mounted(){
 const dom=new JSDOM('<div id="mw-header-actions"><button id="mw-version-history">Version history</button></div><p id="mw-editor-status"></p>',{url:'https://example.test/customer/',runScripts:'outside-only'}),w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 w.LeadIntelRichText=require('../rich-text.js');w.eval(fs.existsSync(file)?fs.readFileSync(file,'utf8'):'');
 let current={...scope},value={subject:'Current',message:'Current text',sender:'Edgars'},usable=true,restored=[],resolvePage;
 const api=w.LeadIntelMessageDraftHistory?.mount(w.document,{scope:()=>current,read:()=>value,usable:()=>usable,restore:row=>{value={...row};restored.push(row);return true},load:()=>new Promise(resolve=>resolvePage=resolve)});
 return {w,api,restored,get page(){return resolvePage},switchBuyer(){current={...current,personId:'p2'}},edit(){value.message='New edit'},get value(){return value},block(){usable=false}};
}
test('history previews safely, preserves displaced text and requires unchanged context before restore',async()=>{
 const h=mounted();assert.ok(h.api,'history controls must mount');const j=H.createJournal(h.w.localStorage);j.record(scope,{...draft,sender:'Kaspars Mazurs'},{recoverable:true});
 const pending=h.api.open();h.page({activities:[],next_cursor:null});await pending;
 const popup=h.w.document.querySelector('#mw-history-dialog');assert.ok(popup);popup.querySelector('[data-history-version]').click();assert.equal(h.restored.length,0);assert.match(popup.textContent,/Kaspars Mazurs/);
 popup.querySelector('[data-history-restore]').click();assert.equal(h.restored.length,1);assert.equal(h.value.message,draft.message);assert.ok(j.list(scope).some(r=>r.message==='Current text'));h.w.close();
});
test('late history responses cannot render or restore another buyer; edits after preview also block restore',async()=>{
 for(const change of ['buyer','edit']){const h=mounted();assert.ok(h.api);H.createJournal(h.w.localStorage).record(scope,draft,{recoverable:true});const pending=h.api.open();h.page({activities:[],next_cursor:null});await pending;const popup=h.w.document.querySelector('#mw-history-dialog');popup.querySelector('[data-history-version]').click();if(change==='buyer')h.switchBuyer();else h.edit();popup.querySelector('[data-history-restore]').click();assert.equal(h.restored.length,0);h.w.close();}
 const h=mounted();const pending=h.api.open();h.switchBuyer();h.page({activities:[],next_cursor:null});await pending;assert.equal(h.w.document.querySelectorAll('[data-history-version]').length,0);h.w.close();
});

test('real editor typing survives a new page session and recovery restores a reviewable unsaved draft',async()=>{
 const {mounted}=require('./helpers/message-runtime.js'),runtime=fs.readFileSync(file,'utf8')+`\nLeadIntelServerBridge.session.user.id='u1';LeadIntelServerBridge.listCrmCompanies=async()=>({ok:true,companies:[]});HTMLDialogElement.prototype.showModal=function(){this.open=true};HTMLDialogElement.prototype.close=function(){this.open=false};installMessageDraftHistory();renderAll();`;
 const first=mounted({selected:'professional',runtimeSetup:runtime});let second;
 try{first.q('mw-edit-message').click();first.q('outreach-email-subject').value='  My exact subject  ';first.q('outreach-email-body').value='My exact unsaved message.\n\nKaspars Mazurs  ';first.q('outreach-email-body').dispatchEvent(new first.w.Event('input',{bubbles:true}));
 const copies={};for(let i=0;i<first.w.localStorage.length;i++){const k=first.w.localStorage.key(i);if(k.startsWith('leadintel:message-history:'))copies[k]=first.w.localStorage.getItem(k);}
 assert.ok(Object.keys(copies).length);const savedState=JSON.parse(first.w.localStorage.getItem('leadintel_customer_v2_outreach'));
 second=mounted({selected:'professional',outreachSnapshot:savedState,runtimeSetup:Object.entries(copies).map(([k,v])=>'localStorage.setItem('+JSON.stringify(k)+','+JSON.stringify(v)+');').join('\n')+runtime});
 assert.equal(second.q('mw-draft-recovery').hidden,false);assert.notEqual(second.q('outreach-email-body').value,'My exact unsaved message.\n\nKaspars Mazurs  ');
 await second.w.LeadIntelMessageDraftController.open();const popup=second.q('mw-history-dialog');popup.querySelector('[data-history-version]').click();assert.match(popup.textContent,/Kaspars Mazurs/);popup.querySelector('[data-history-restore]').click();
 assert.equal(second.q('outreach-email-subject').value,'  My exact subject  ');assert.equal(second.q('outreach-email-body').value,'My exact unsaved message.\n\nKaspars Mazurs  ');assert.equal(second.item().approved,false);assert.equal(require('../message-editor.js').savedDraft(second.item()),false);
 }finally{first.w.close();second?.w.close();}
});
test('a failed checkpoint blocks replacement of the real working message but permits explicit CRM save',()=>{
 const {mounted}=require('./helpers/message-runtime.js'),h=mounted({selected:'professional'});try{
 h.w.LeadIntelMessageDraftController={beforeChange:()=>false,render(){}};const before=h.item().drafts.emailBody;
 assert.throws(()=>h.w.eval("upsertItem(LeadIntelMessageEditor.apply(currentItem(),{subject:'Replace',message:'Replacement'}))"),/recovery|previous version/i);assert.equal(h.item().drafts.emailBody,before);
 h.w.eval("upsertItem({...currentItem(),drafts:{...currentItem().drafts,emailBody:'Explicit save'},messageStudioDraft:{...currentItem().messageStudioDraft,savePending:true}})");assert.equal(h.item().drafts.emailBody,'Explicit save');
 }finally{h.w.close();}
});
test('restoring a historical style selects that style without changing the historical sender on rerender',async()=>{
 const {mounted}=require('./helpers/message-runtime.js'),runtime=fs.readFileSync(file,'utf8')+`\nLeadIntelServerBridge.session.user.id='u1';LeadIntelServerBridge.listCrmCompanies=async()=>({ok:true,companies:[]});HTMLDialogElement.prototype.showModal=function(){this.open=true};HTMLDialogElement.prototype.close=function(){this.open=false};installMessageDraftHistory();renderAll();`;
 const h=mounted({selected:'professional',runtimeSetup:runtime});try{const scoped={...scope,domain:'buyer.example'};H.createJournal(h.w.localStorage).record(scoped,{subject:'Kaspars. Invitation',message:'Hello, I am Kaspars Mazurs.',sender:'Kaspars Mazurs',style:'friendly'});await h.w.LeadIntelMessageDraftController.open();const popup=h.q('mw-history-dialog');popup.querySelector('[data-history-version]').click();popup.querySelector('[data-history-restore]').click();assert.equal(h.q('message-mode').value,'friendly');h.w.eval('renderAll()');assert.equal(h.q('outreach-email-body').value,'Hello, I am Kaspars Mazurs.');assert.equal(h.item().messageStudioDraft.senderReference.name,'Kaspars Mazurs');}finally{h.w.close();}
});
test('older CRM pages append filtered previews and stop at the end of recipient history',async()=>{
 const h=mounted();try{const activity=(id,body,personId='p1')=>({id,occurred_at:'2026-10-25T09:00:00Z',metadata:{script_package:{version:1,item:{domain:'buyer.test',selectedPersonId:personId,channel:'email',drafts:{emailSubject:'Saved '+id,emailBody:body},messageStudioDraft:{essentials:{sender:'Kaspars Mazurs'}}}}}});
 const opening=h.api.open();h.page({activities:[activity('recent','Recent CRM text')],next_cursor:'older-cursor'});await opening;const popup=h.w.document.querySelector('#mw-history-dialog'),more=[...popup.querySelectorAll('button')].find(b=>b.textContent==='Load older saved versions');assert.equal(more.hidden,false);more.click();h.page({activities:[activity('other','Other buyer private text','p2'),activity('old','Older CRM text')],next_cursor:null});await new Promise(r=>setImmediate(r));assert.equal(popup.querySelectorAll('[data-history-version]').length,2);assert.equal(more.hidden,true);popup.querySelectorAll('[data-history-version]')[1].click();assert.match(popup.textContent,/Older CRM text/);assert.doesNotMatch(popup.textContent,/Other buyer private text/);
 }finally{h.w.close();}
});
