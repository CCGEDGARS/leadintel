const test=require('node:test'),assert=require('node:assert/strict');
const O=require('../outreach-engine.js');
const fixture=()=>({domain:'example.com',selectedPersonId:'deleted-teemu',channel:'email',dossier:{domain:'example.com',company:'Example',people:[{id:'klas',name:'Klas Buyer',title:'Director',email:'klas@example.com'}],evidence:[]},drafts:{emailSubject:'Saved manual subject',emailBody:'Saved manual body',linkedinMessage:'Saved LinkedIn text'}});
test('normalization never assigns the first dossier person to an obsolete selected ID',()=>{
 const value=O.normalizeOutreachState({items:[fixture()]}).items[0];
 assert.equal(value.drafts.scriptContext.buyerName,'');assert.equal(value.selectedPersonId,'deleted-teemu');
 assert.equal(value.drafts.emailBody,'Saved manual body');assert.equal(value.drafts.emailSubject,'Saved manual subject');assert.equal(value.drafts.linkedinMessage,'Saved LinkedIn text');
});
test('CRM snapshot round trip preserves manual text without inventing a replacement recipient',()=>{
 const value=O.restoreCrmScriptSnapshot(O.buildCrmScriptSnapshot(fixture()),'example.com');
 assert.equal(value.drafts.scriptContext.buyerName,'');assert.equal(value.selectedPersonId,'deleted-teemu');assert.equal(value.drafts.emailBody,'Saved manual body');
});
test('reordering saved people never changes the exact selected recipient context',()=>{
 const value=fixture();value.selectedPersonId='teemu';value.dossier.people.push({id:'teemu',name:'Teemu Buyer',email:'teemu@example.com'});
 const first=O.buildCrmScriptSnapshot(value);value.dossier.people.reverse();const second=O.buildCrmScriptSnapshot(value);
 assert.equal(first.item.drafts.scriptContext.buyerName,'Teemu Buyer');assert.equal(second.item.drafts.scriptContext.buyerName,'Teemu Buyer');
});
