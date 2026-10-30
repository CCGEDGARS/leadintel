const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const D=require('../discovery-engine.js'),source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
function install(ctx,name){
 const start=source.indexOf(`async function ${name}(`),next=source.slice(start+1).search(/\n(?:async )?function /);
 assert.ok(start>=0&&next>=0,name);vm.runInContext(source.slice(start,start+1+next),ctx);
}
function harness(){
 const anna={id:'anna',name:'Anna Buyer',title:'COO',kept:false},bob={id:'bob',name:'Bob Buyer',title:'COO',kept:true},candidate={domain:'example.com',people:[anna,bob]};
 const contacts=[anna,bob].map(person=>({id:`contact-${person.id}`,external_person_id:person.id,name:person.name,work_email:`${person.id}@example.com`,email_status:'verified'}));
 let meta={},reads=0;const writes=[],research=[];
 const b={workspace:{id:'w1'},session:{user:{id:'u1'}},saveCrmContacts:async(_id,people)=>{writes.push(...people);return {ok:true};},saveNow:async()=>({saved:true}),getCrmCompany:async()=>{reads++;return {ok:true,contacts};}};
 const ctx={Date,LeadIntelDiscovery:{...D,qualifyBuyer:()=>({eligible:true})},discovery:{selectedProspects:[candidate]},canonicalDomain:D.canonicalDomain,crmAuthenticated:()=>true,bridge:()=>b,personKey:(_c,p)=>p.id,enrichmentPending:new Set(),buyerSelectionPending:new Set(),enrichmentResults:new Map(contacts.map(contact=>[contact.external_person_id,{contact}])),ensureCrmCompany:async()=>({id:'company'}),crmCompanyByDomain:()=>({id:'company'}),verifiedBuyerEmail:(_c,p,c)=>c.external_person_id===p.id?c.work_email:'',loadMeta:()=>meta,saveMeta:value=>{meta=value;},saveDiscovery(){},renderAll(){},renderPipeline(){},renderSelectedEmailBuyer(){},showToast(){},window:{LeadIntelCrm:{mapContacts:people=>people},dispatchEvent(){}},findPublicProspectContacts:async(...args)=>{research.push(args);return true;}};
 vm.createContext(ctx);for(const name of ['keepBuyer','addBuyerToFlow','saveBuyerAndProceed','recheckBuyerContact'])install(ctx,name);
 return {ctx,anna,bob,candidate,b,writes,research,get meta(){return meta;},get reads(){return reads;}};
}
test('mounted Recheck and Proceed forward the stable identity rendered on their cards',()=>{
 const line=source.split('\n').find(line=>line.includes('$("customer-pipeline")?.addEventListener("click"')&&line.includes('recheckBuyerContact'));
 for(const [attribute,method] of [['data-recheck-buyer','recheckBuyerContact'],['data-keep-buyer','saveBuyerAndProceed']]){
  const h=harness(),button=new JSDOM(`<button ${attribute}="example.com" data-person-index="0" data-person-id="anna"></button>`).window.document.querySelector('button');let handler,request;
  h.ctx.$=()=>({addEventListener:(_type,fn)=>{handler=fn;}});h.ctx[method]=(...args)=>{request=args;};vm.runInContext(line,h.ctx);handler({target:button});
  assert.equal(request[2]?.personId,'anna',`${method} dropped the card identity`);
 }
});
test('Recheck targets the card identity after saved research reorders the underlying shortlist',async()=>{
 const h=harness();h.candidate.people.reverse();
 assert.equal(await h.ctx.recheckBuyerContact('example.com',0,{personId:h.anna.id}),true);
 assert.deepEqual(Array.from(h.research[0][1].personIds),['anna']);
});
test('Proceed saves the card identity when its old index now belongs to another buyer',async()=>{
 const h=harness();h.candidate.people.reverse();
 assert.equal(await h.ctx.saveBuyerAndProceed('example.com',0,{personId:h.anna.id}),true);
 assert.equal(h.meta.selectedEmailBuyer.personId,h.anna.id);assert.equal(h.meta.selectedEmailBuyer.contactId,'contact-anna');
});
test('Proceed retains the same recipient when CRM contact saving reorders the shortlist',async()=>{
 const h=harness();h.b.saveCrmContacts=async(_id,people)=>{h.writes.push(...people);h.candidate.people.reverse();return {ok:true};};
 assert.equal(await h.ctx.saveBuyerAndProceed('example.com',0,{personId:h.anna.id}),true);
 assert.equal(h.writes[0].id,h.anna.id);assert.equal(h.meta.selectedEmailBuyer.personId,h.anna.id);assert.equal(h.meta.selectedEmailBuyer.contactId,'contact-anna');
});
test('a removed stable identity never falls through to the buyer occupying its old index',async()=>{
 for(const method of ['recheckBuyerContact','saveBuyerAndProceed','keepBuyer','addBuyerToFlow']){
  const h=harness();h.candidate.people=[h.bob];
  assert.equal(await h.ctx[method]('example.com',0,{personId:h.anna.id}),false,method);
  assert.equal(h.research.length,0);assert.equal(h.writes.length,0);assert.equal(h.reads,0);assert.equal(h.meta.selectedEmailBuyer,undefined);
 }
});
test('late contact saves cannot mutate or save the replacement workspace',async()=>{
 for(const phase of ['company','contact','sync']){
  const h=harness();let finish,saves=0;h.ctx.saveDiscovery=()=>{saves++;};
  if(phase==='company')h.ctx.ensureCrmCompany=()=>new Promise(resolve=>finish=resolve);
  if(phase==='contact')h.b.saveCrmContacts=()=>new Promise(resolve=>finish=resolve);
  if(phase==='sync')h.b.saveNow=()=>new Promise(resolve=>finish=resolve);
  const pending=h.ctx.keepBuyer('example.com',0,{personId:h.anna.id});await new Promise(resolve=>setImmediate(resolve));
  h.b.workspace.id='w2';h.ctx.discovery={selectedProspects:[]};const before=saves;
  finish(phase==='company'?{id:'company'}:phase==='contact'?{ok:true}:{saved:false});
  assert.equal(await pending,false,phase);assert.equal(saves,before,phase);assert.equal(h.ctx.discovery.selectedProspects.length,0);assert.equal(h.meta.selectedEmailBuyer,undefined);
 }
});
test('a stale CRM verification cannot select a removed, replaced or different-user buyer',async()=>{
 for(const mode of ['removed','replaced','user']){
  const h=harness();h.anna.kept=true;let finish;h.b.getCrmCompany=()=>new Promise(resolve=>finish=resolve);
  const pending=h.ctx.addBuyerToFlow('example.com',0,{personId:h.anna.id,selectOnly:true});
  if(mode==='removed')h.candidate.people=[h.bob];
  if(mode==='replaced')h.candidate.people=[{...h.anna,name:'Different Buyer'},h.bob];
  if(mode==='user')h.b.session.user.id='u2';
  finish({ok:true,contacts:[h.ctx.enrichmentResults.get('anna').contact]});
  assert.equal(await pending,false,mode);assert.equal(h.meta.selectedEmailBuyer,undefined,mode);
 }
});
test('a late sync failure cannot roll old recipient metadata into a replacement workspace',async()=>{
 const h=harness();h.anna.kept=true;let finish;h.b.saveNow=()=>new Promise(resolve=>finish=resolve);
 const pending=h.ctx.addBuyerToFlow('example.com',0,{personId:h.anna.id,selectOnly:true});await new Promise(resolve=>setImmediate(resolve));
 h.b.workspace.id='w2';h.ctx.discovery={selectedProspects:[]};h.ctx.saveMeta({workspaceMarker:'new workspace'});
 finish({saved:false});assert.equal(await pending,false);assert.equal(h.meta.workspaceMarker,'new workspace');assert.equal(h.meta.selectedEmailBuyer,undefined);
});
