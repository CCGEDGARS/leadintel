const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
async function fixture(){
 const dom=new JSDOM('<section id="message-studio"><details></details></section>',{runScripts:'outside-only'}),w=dom.window;
 let sync,now=1000,failBooks=true,failSkills=true,calls=0,card={id:'book',slot:1,filename:'guide.txt',status:'Processing',revision:1};
 w.Date.now=()=>now;w.setInterval=fn=>sync=fn;w.LeadIntelServerBridge={session:{authenticated:true},workspace:{id:'w1'}};
 w.LeadIntelWritingReferences=require('../writing-references-ui.js');
 w.LeadIntelWritingReferencesApi={createWritingReferencesApi:({onResult})=>({
  list:async()=>{calls++;if(failBooks)throw Error('Temporary connection failure');const data={cards:[{...card}],referenceRevision:1};onResult(data);return data;},
  listSkills:async()=>{if(failSkills)throw Error('Temporary skills failure');return {skills:[]};}
 })};
 const changes=[];w.addEventListener('leadintel:writing-references-changed',()=>changes.push(w.LeadIntelWritingReferenceSelection.sessionSnapshot()));
 w.eval(fs.readFileSync(require.resolve('../writing-references-loader.js'),'utf8'));await settle();
 return {w,changes,get calls(){return calls;},recover(){failBooks=false;failSkills=false;},booksOnly(){failBooks=false;},ready(){card={...card,status:'Ready',revision:2,summary:'Ask a clear question.'};},async advance(ms=61000){now+=ms;sync();await settle();},close(){w.close();}};
}
test('an initial library outage retries without focus or reload and stops polling once settled',async()=>{
 const f=await fixture();try{
  assert.match(f.w.document.body.textContent,/Retrying shortly/);f.recover();f.ready();await f.advance();
  assert.equal(f.calls,2);assert.equal(f.w.LeadIntelWritingReferenceSelection.sessionSnapshot().cards[0].status,'Ready');
  assert.doesNotMatch(f.w.document.body.textContent,/Retrying shortly/);await f.advance();assert.equal(f.calls,2);
 }finally{f.close();}
});
test('background completion notifies the assistant even when the skills service is unavailable',async()=>{
 const f=await fixture();try{
  f.booksOnly();f.w.dispatchEvent(new f.w.Event('focus'));await settle();assert.equal(f.changes.at(-1).cards[0].status,'Processing');
  f.ready();await f.advance();assert.equal(f.changes.at(-1).cards[0].status,'Ready');
  assert.equal(f.w.LeadIntelWritingReferenceSelection.toggleSession('book'),true);
  assert.equal(f.w.LeadIntelWritingReferenceSelection.sessionSnapshot().sourceRefs[0].revision,2);
 }finally{f.close();}
});
test('a focused library tab does not freeze progress, while editing details still protects unsaved text',async()=>{
 const f=await fixture();try{
  f.recover();f.w.dispatchEvent(new f.w.Event('focus'));await settle();
  f.w.document.querySelector('[data-library-tab="books"]').focus();f.ready();await f.advance();
  assert.equal(f.w.LeadIntelWritingReferenceSelection.sessionSnapshot().cards[0].status,'Ready');
  const title=f.w.document.querySelector('[data-book-title]');title.focus();title.value='Unsaved title';
  f.w.dispatchEvent(new f.w.Event('focus'));await settle();assert.equal(f.w.document.querySelector('[data-book-title]'),title);assert.equal(title.value,'Unsaved title');
 }finally{f.close();}
});
