const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const P=require('../contact-confirmation-policy.js');
test('confirmed personal email requires verified provider evidence and a named contact',()=>{
 const c={name:'Anna Andersson',work_email:'anna@gmail.com',email_status:'verified',verification_provider:'Apollo',email_type:'personal',external_person_id:'anna'};
 assert.equal(P.accepted(c,'example.com'),true);
 for(const change of [{email_status:'guessed'},{email_status:'public_unverified'},{verification_provider:'unknown'},{name:''},{external_person_id:''},{email_type:'work'},{work_email:'info@gmail.com'},{archived_at:'today'}])assert.equal(P.accepted({...c,...change},'example.com'),false);
});
test('recheck runs only public research for the original person with force enabled',async()=>{
 const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8'),calls=[],p={id:'p',name:'Anna Andersson'},c={domain:'example.com',people:[p]};
 const ctx={discovery:{selectedProspects:[c]},canonicalDomain:x=>x,crmAuthenticated:()=>true,bridge:()=>({conflict:false}),enrichmentPending:new Set(),personKey:()=> 'p',findPublicProspectContacts:async(...args)=>{calls.push(args);return true;}};
 vm.createContext(ctx);const start=source.indexOf('async function recheckBuyerContact(');assert.ok(start>=0);vm.runInContext(source.slice(start,source.indexOf('async function findPublicProspectContacts(',start)),ctx);
 assert.equal(await ctx.recheckBuyerContact('example.com',0),true);assert.equal(calls.length,1);assert.equal(calls[0][1].force,true);assert.deepEqual(Array.from(calls[0][1].personIds),['p']);
 ctx.bridge=()=>({conflict:true});assert.equal(await ctx.recheckBuyerContact('example.com',0),false);assert.equal(calls.length,1);
});
