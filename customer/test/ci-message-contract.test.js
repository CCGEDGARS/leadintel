const test=require('node:test'),assert=require('node:assert/strict'),M=require('../message-studio.js');
const e={sender:'Alex Smith',company:'LegalCo',value:'simplify contract review',offer:'legal advice',calendly:'https://calendly.com/alex/20min'};
test('active personal subject aliases retain current full sender identity',()=>{
 const s=M.savePersonalStyle(M.normalize({mode:'professional'},e),'professional',{subject:'From {{senderFullName}} at {{senderCompany}}',body:'Hi {{firstName}}, {{offer}}'});
 assert.equal(M.resolveApprovedSubject(s,{firstName:'Sam',buyerCompany:'ClientCo'},e),'From Alex Smith at LegalCo');
});
test('every active channel and pitch preview uses the agreed 20-minute meeting',()=>{
 for(const t of [...M.defaults,...M.linkedinDefaults]){assert.match(t.body,/20[- ]minute|20 minutes/);assert.doesNotMatch(t.body,/30[- ]minute|30 minutes/);}
 assert.match(M.preview({...e,meetingValue:'requirements'}),/20-minute Zoom/);
});
test('approved example buyers and archived scripts never enter a current generation prompt',()=>{
 for(const mode of ['professional','curiosity','friendly','brutal']){const p=M.prompt(M.normalize({mode},e),{buyerCompany:'ClientCo'});assert.doesNotMatch(p.prompt,/Joakim|LKAB|ERCON|Malmberget/);}
});
