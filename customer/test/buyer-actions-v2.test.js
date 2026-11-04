const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const P=require('../contact-confirmation-policy.js');
test('confirmed personal email requires verified provider evidence and a named contact',()=>{
 const c={name:'Anna Andersson',work_email:'anna@gmail.com',email_status:'verified',verification_provider:'Apollo',email_type:'personal',external_person_id:'anna'};
 assert.equal(P.accepted(c,'example.com'),true);
 for(const change of [{email_status:'guessed'},{email_status:'public_unverified'},{verification_provider:'unknown'},{name:''},{external_person_id:''},{email_type:'work'},{work_email:'info@gmail.com'},{archived_at:'today'}])assert.equal(P.accepted({...c,...change},'example.com'),false);
});
test('recheck runs only public research for the original person with force enabled',async()=>{
 const r=require('./helpers/buyer-controls-runtime.cjs').runtime(),calls=[];
 try{
  r.c.findPublicProspectContacts=async(...args)=>{calls.push(args);return true;};
  assert.equal(await r.c.recheckBuyerContact('example.com',0),true);assert.equal(calls.length,1);assert.equal(calls[0][1].force,true);assert.deepEqual(Array.from(calls[0][1].personIds),[r.person.id]);
  r.b.conflict=true;assert.equal(await r.c.recheckBuyerContact('example.com',0),false);assert.equal(calls.length,1);assert.match(r.calls.join(' '),/sync conflict/);
 }finally{r.close();}
});
