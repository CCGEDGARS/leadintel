'use strict';
const assert=require('node:assert/strict');
const O=require('../../outreach-engine.js');

// Synthetic test data only. Approval still executes the shipping recipient,
// language, exact-text and context checks; no approval verdict is stubbed.
function messageFixture(input={},recipient={}){
 const domain=input.domain||String(recipient.email||'').split('@')[1]||'fixture-buyer.example';
 const id=input.selectedPersonId||recipient.personId||'fixture-recipient';
 const people=input.dossier?.people||[],matches=people.filter(person=>person.id===id),selected=matches[0]||{};
 assert.ok(matches.length<=1,'Synthetic approval fixture requires a unique selected recipient');
 const person={...selected,id,name:recipient.name||selected.name||selected.publicName||'Fixture Recipient '+id,email:recipient.email||selected.email||id+'@'+domain};
 const base={...input,domain,channel:input.channel||'email',selectedPersonId:id,dossier:{...input.dossier,domain:input.dossier?.domain||domain,people:matches.length?people.map(row=>row.id===id?person:row):[...people,person]},campaignScenario:input.campaignScenario||{language:'en',resolvedLanguage:'en'},localizationStatus:input.localizationStatus||'complete',localizationProvenance:input.localizationProvenance||{provider:'fixture-manual-review',model:'fixture-manual-v1',language:'en',selectionSource:'manual'}};
 return O.normalizeOutreachState({items:[base]}).items[0];
}
function approveMessage(input={},options={}){
 const item=messageFixture(input,options);
 const approved=O.approveOutreachItem(item,item.drafts,options.approvedAt||input.approvedAt||'2026-10-24T05:00:00Z',options.approvalOptions||{});
 assert.equal(approved.approved,true,approved.error||'Synthetic message approval failed');
 assert.equal(O.approvalCurrent(approved),true,'Synthetic approval must satisfy the shipping authority contract');
 return approved;
}
module.exports={messageFixture,approveMessage};
