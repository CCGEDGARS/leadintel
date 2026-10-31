const test=require('node:test'),assert=require('node:assert/strict');
const {runtime,gate}=require('./helpers/buyer-controls-runtime.cjs');
test('Proceed rejects a CRM email changed since the displayed confirmed address was reviewed',async()=>{
 const r=runtime();try{r.person.kept=true;r.seed(r.contact());r.b.getCrmCompany=async()=>r.detail([r.contact({work_email:'avery.new@example.com',normalized_email:'avery.new@example.com'})]);
 assert.equal(await r.c.saveBuyerAndProceed('example.com',0,{personId:r.person.id}),false);
 assert.equal(r.c.loadMeta().selectedEmailBuyer,undefined);assert.equal(r.eval('enrichmentResults.get("example.com|person-a").contact.work_email'),'avery@example.com');
 assert.ok(r.calls.some(v=>typeof v==='string'&&/email|address/i.test(v)&&/changed|review|refresh/i.test(v)));
 }finally{r.close();}
});
test('Proceed cannot overwrite a newer cached recipient with an older CRM response',async()=>{
 const r=runtime();try{r.person.kept=true;r.seed(r.contact());const g=gate();r.b.getCrmCompany=()=>g.promise;
 const run=r.c.saveBuyerAndProceed('example.com',0,{personId:r.person.id});await new Promise(setImmediate);r.seed(r.contact({work_email:'avery.new@example.com',normalized_email:'avery.new@example.com'}));g.resolve(r.detail([r.contact()]));
 assert.equal(await run,false);assert.equal(r.c.loadMeta().selectedEmailBuyer,undefined);assert.equal(r.eval('enrichmentResults.get("example.com|person-a").contact.work_email'),'avery.new@example.com');
 }finally{r.close();}
});
test('Proceed preserves an unchanged reviewed address across CRM read and card reorder',async()=>{
 const r=runtime();try{r.person.kept=true;r.seed(r.contact());const g=gate();r.b.getCrmCompany=()=>g.promise;
 const run=r.c.saveBuyerAndProceed('example.com',0,{personId:r.person.id});await new Promise(setImmediate);r.candidate.people.reverse();g.resolve(r.detail([r.contact()]));
 assert.equal(await run,true);assert.equal(r.c.loadMeta().selectedEmailBuyer.personId,r.person.id);assert.equal(r.c.loadMeta().selectedEmailBuyer.email,'avery@example.com');assert.equal(r.other.flowSelected,false);
 }finally{r.close();}
});
test('Proceed retains the reviewed address across Keep and refuses a changed cache before CRM selection',async()=>{
 const r=runtime();try{r.seed(r.contact());const g=gate();r.b.saveCrmContacts=()=>g.promise;r.b.getCrmCompany=async()=>r.detail([r.contact({work_email:'avery.new@example.com',normalized_email:'avery.new@example.com'})]);
 const run=r.c.saveBuyerAndProceed('example.com',0,{personId:r.person.id});await new Promise(setImmediate);r.seed(r.contact({work_email:'avery.new@example.com',normalized_email:'avery.new@example.com'}));g.resolve({ok:true});
 assert.equal(await run,false);assert.equal(r.c.loadMeta().selectedEmailBuyer,undefined);assert.equal(r.eval('enrichmentResults.get("example.com|person-a").contact.work_email'),'avery.new@example.com');
 }finally{r.close();}
});
test('a changed address during selection synchronization rolls back only its own selection',async()=>{
 const r=runtime();try{r.person.kept=true;r.seed(r.contact());r.b.getCrmCompany=async()=>r.detail([r.contact()]);const g=gate();r.b.saveNow=()=>g.promise;r.c.saveMeta({preserved:'manual draft'});
 const run=r.c.saveBuyerAndProceed('example.com',0,{personId:r.person.id});await new Promise(setImmediate);assert.equal(r.c.loadMeta().selectedEmailBuyer.email,'avery@example.com');r.seed(r.contact({work_email:'avery.new@example.com',normalized_email:'avery.new@example.com'}));g.resolve({saved:true});
 assert.equal(await run,false);assert.equal(r.c.loadMeta().selectedEmailBuyer,undefined);assert.equal(r.c.loadMeta().preserved,'manual draft');assert.equal(r.eval('enrichmentResults.get("example.com|person-a").contact.work_email'),'avery.new@example.com');
 }finally{r.close();}
});
test('multiple confirmed CRM addresses retain the exact reviewed contact instead of choosing another',async()=>{
 const r=runtime();try{r.person.kept=true;r.seed(r.contact());r.b.getCrmCompany=async()=>r.detail([r.contact({id:'contact-other',work_email:'avery.new@example.com',normalized_email:'avery.new@example.com'}),r.contact()]);
 assert.equal(await r.c.saveBuyerAndProceed('example.com',0,{personId:r.person.id}),true);assert.equal(r.c.loadMeta().selectedEmailBuyer.contactId,'contact-a');assert.equal(r.c.loadMeta().selectedEmailBuyer.email,'avery@example.com');
 }finally{r.close();}
});
