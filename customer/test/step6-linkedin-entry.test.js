const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {runtime}=require('./helpers/buyer-controls-runtime.cjs');
const D=require('../discovery-engine.js');
const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));

function setup(){
 const h=runtime();h.person.publicLinkedinUrl='https://linkedin.com/in/avery-buyer';
 h.dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 h.dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new h.dom.window.Event('close'));};
 h.eval(source.split('\n').find(line=>line.includes('$("customer-pipeline")?.addEventListener("click"')));
 h.draw=()=>{h.dom.window.document.getElementById('customer-pipeline').innerHTML='<article>'+h.c.buyerContactRows(h.person,h.candidate)+h.c.prospectContactControls(h.candidate,h.person)+'</article>';return h.dom.window.document.querySelector('[data-review-linkedin]');};
 h.dialog=()=>h.dom.window.document.getElementById('buyer-review-dialog');
 return h;
}

test('unreviewed LinkedIn field offers the existing review dialog without changing the four contact actions',()=>{
 const h=setup();try{
  const button=h.draw();assert.ok(button,'unreviewed direct profiles need a visible Review profile control');
  assert.equal(button.textContent,'Review profile');assert.equal(button.closest('[data-contact-channel]').dataset.contactChannel,'linkedin');
  assert.equal(button.dataset.reviewLinkedin,h.candidate.domain);assert.equal(button.dataset.personId,h.person.id);assert.equal(button.dataset.personIndex,'0');assert.ok(button.dataset.personIdentity);assert.ok(button.dataset.buyerContext);
  assert.equal(button.disabled,false);assert.equal(button.closest('.buyer-four-actions'),null);
  assert.deepEqual([...h.dom.window.document.querySelector('.buyer-four-actions').querySelectorAll('button')].map(b=>b.textContent),['E-mail','Phone','Recheck','Proceed']);
  button.click();assert.equal(h.dialog()?.open,true);assert.match(h.dialog().textContent,/Avery Buyer/);assert.ok(h.dialog().querySelector('[data-review-confirm]'));assert.ok(h.dialog().querySelector('[data-review-message]'));
  assert.equal(h.person.linkedinConfirmedUrl,undefined);assert.equal(h.calls.some(call=>call?.type==='leadintel:buyer-for-scripts'),false,'opening review neither confirms nor opens Messages');
 }finally{h.close();}
});

test('full selected-buyer rendering accepts the real ranker copy only when its retained identity matches',()=>{
 const h=setup();try{
  h.c.LeadIntelDiscovery.qualifyBuyer=D.qualifyBuyer;
  const ranked=D.rankedBuyerShortlist(h.candidate.people,{decisionMakers:h.candidate.buyerRoles},h.candidate),copy=ranked.people.find(person=>person.id===h.person.id);
  assert.ok(copy);assert.notEqual(copy,h.person,'the real ranker renders enriched copies');
  const pipeline=h.dom.window.document.getElementById('customer-pipeline');pipeline.innerHTML=h.c.renderSelectedProspects([h.candidate]);
  const button=pipeline.querySelector('[data-review-linkedin][data-person-id="person-a"]');assert.ok(button,'full ranked buyer card keeps its guarded review entry');
  assert.equal(button.dataset.personIdentity,h.c.buyerActionIdentity(h.candidate,h.person,true));button.click();assert.equal(h.dialog()?.open,true);assert.match(h.dialog().textContent,/Avery Buyer/);
  h.dialog().close();
  for(const [field,value] of [['name','Different Buyer'],['title','Different Role'],['organization','Different Employer'],['publicNameUrl','https://example.com/other'],['publicLinkedinUrl','https://linkedin.com/in/another'],['id','other-id']]){
   const changed={...copy,[field]:value};pipeline.innerHTML=h.c.buyerContactRows(changed,h.candidate);assert.equal(pipeline.querySelector('[data-review-linkedin]'),null,field+' mismatch cannot review a copied identity');
  }
 }finally{h.close();}
});

test('review uses stable person ownership after a reorder and rejects stale identity or account controls',()=>{
 for(const change of ['reorder','name','organization','profile','workspace','user','role']){
  const h=setup();try{
   const button=h.draw();assert.ok(button);
   if(change==='reorder')h.candidate.people.reverse();
   if(change==='name')h.person.name='Replacement Buyer';
   if(change==='organization')h.person.organization='Other Employer';
   if(change==='profile')h.person.publicLinkedinUrl='https://linkedin.com/in/replacement';
   if(change==='workspace')h.b.workspace={...h.b.workspace,id:'other-workspace'};
   if(change==='user')h.b.session.user={id:'other-user'};
   if(change==='role')h.b.workspace.role='member';
   button.click();
   if(change==='reorder'){assert.equal(h.dialog()?.open,true);assert.match(h.dialog().textContent,/Avery Buyer/);assert.doesNotMatch(h.dialog().textContent,/Blair Buyer/);}
   else{assert.equal(h.dialog(),null,change+' invalidates the rendered control');assert.match(h.calls.at(-1),/changed|current buyer/i);}
   assert.equal(h.person.linkedinConfirmedUrl,undefined);
  }finally{h.close();}
 }
});

test('only exact retained unreviewed identities show Review profile; existing matches retain their status',()=>{
 for(const kind of ['missing','invalid','pending','duplicate','manual','automatic','unselected']){
  const h=setup();try{
   if(kind==='missing')h.person.publicLinkedinUrl='';
   if(kind==='invalid')h.person.publicLinkedinUrl='https://linkedin.com/company/example';
   if(kind==='pending')h.person.identityStatus='pending';
   if(kind==='duplicate')h.candidate.people.push({...h.person});
   if(kind==='manual'){h.person.linkedinConfirmedUrl=h.person.publicLinkedinUrl;h.person.linkedinConfirmationMethod='manual';}
   if(kind==='automatic')h.person.publicNameUrl=h.person.publicLinkedinUrl;
   if(kind==='unselected')h.eval('discovery.selectedProspects=[]');
   assert.equal(h.draw(),null,kind+' does not add an unreviewed-profile control');
   if(kind==='manual')assert.match(h.dom.window.document.querySelector('[data-contact-channel="linkedin"]').textContent,/Manually reviewed/);
   if(kind==='automatic')assert.match(h.dom.window.document.querySelector('[data-contact-channel="linkedin"]').textContent,/Profile matched automatically/);
  }finally{h.close();}
 }
});

test('review control respects sign-in, sync and current buyer operation gates',()=>{
 for(const gate of ['signed-out','sync','resolving','research','contact','selection','saving','removing']){
  const h=setup();try{
   if(gate==='signed-out')h.b.session.authenticated=false;
   if(gate==='sync')h.b.conflict=true;
   if(gate==='resolving')h.b.resolvingSync=true;
   if(gate==='research')h.candidate.publicContactStatus='loading';
   if(gate==='contact')h.eval('enrichmentPending.add("example.com|person-a")');
   if(gate==='selection')h.eval('buyerSelectionPending.add("example.com|person-a")');
   if(gate==='saving')h.eval('buyerCompanySavePending.add("example.com")');
   if(gate==='removing')h.eval('buyerCompanyRemovalPending.add("example.com")');
   const button=h.draw();assert.ok(button);assert.equal(button.disabled,true,gate);button.click();assert.equal(h.dialog(),null);
  }finally{h.close();}
 }
});

test('explicit confirmation uses existing CRM review persistence; a stale open dialog cannot confirm',async()=>{
 for(const stale of [false,true]){
  const h=setup();try{
   const writes=[];h.b.saveCrmContacts=async(companyId,contacts)=>{writes.push({companyId,contacts});return {ok:true};};h.b.recordCrmActivity=async(companyId,activity)=>{writes.push({companyId,activity});return {ok:true};};
   const button=h.draw();assert.ok(button);button.click();
   if(stale)h.person.publicName='Changed Buyer';
   h.dialog().querySelector('[data-review-confirm]').click();await tick();
   if(stale){assert.equal(writes.length,0);assert.equal(h.person.linkedinConfirmedUrl,undefined);assert.match(h.dialog().querySelector('[data-review-status]').textContent,/context changed/);}
   else{assert.equal(writes.length,2);assert.equal(writes[0].companyId,'company');assert.equal(writes[0].contacts[0].external_person_id,h.person.id);assert.equal(writes[1].activity.type,'contact.linkedin_confirmed');assert.equal(writes[1].activity.metadata.verification_method,'manual');assert.equal(h.person.linkedinConfirmedUrl,h.person.publicLinkedinUrl);assert.equal(D.linkedInVerification(h.person,h.candidate).status,'manual');assert.equal(h.dialog(),null);assert.equal(h.draw(),null);}
   assert.equal(h.calls.some(call=>call?.type==='leadintel:buyer-for-scripts'),false,'Confirm alone never starts Messages or sends');
  }finally{h.close();}
 }
});

test('review and Proceed hand the exact LinkedIn recipient to Messages through the existing saved selection',async()=>{
 const h=setup();try{
  h.person.kept=true;const writes=[];
  h.b.saveCrmContacts=async(companyId,contacts)=>{writes.push({companyId,contacts});return {ok:true};};
  h.b.recordCrmActivity=async(companyId,activity)=>{writes.push({companyId,activity});return {ok:true};};
  h.b.getCrmCompany=async()=>h.detail([h.contact({linkedin_url:h.person.publicLinkedinUrl})]);
  let loads=0;h.c.loadOutreachModules=async()=>{loads++;};
  const button=h.draw();assert.ok(button);button.click();h.dialog().querySelector('[data-review-message]').click();await tick();
  const selection=h.eval('loadMeta().scriptBuyer'),handoff=h.calls.find(call=>call?.type==='leadintel:buyer-for-scripts');
  assert.ok(handoff);assert.equal(selection.personId,h.person.id);assert.equal(selection.channel,'linkedin');assert.equal(selection.workspaceId,h.b.workspace.id);assert.equal(selection.linkedinUrl,h.person.publicLinkedinUrl);assert.equal(selection.recipientIdentity.name,h.person.name);assert.equal(selection.contactId,'contact-a');
  assert.equal(handoff.detail.personId,h.person.id);assert.equal(handoff.detail.channel,'linkedin');assert.equal(loads,1);assert.equal(h.dialog(),null);
  assert.equal(writes.filter(row=>row.activity).length,1);assert.equal(writes.find(row=>row.activity).activity.type,'contact.linkedin_confirmed','entry records profile review without sending');
 }finally{h.close();}
});
