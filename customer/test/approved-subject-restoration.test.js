const {test}=require('node:test');const assert=require('node:assert/strict');const M=require('../message-studio.js');
test('original approval wording is visible separately from reusable NLP evidence fields',()=>{
 assert.equal(M.approvedSubjectsText('curiosity'),'1. Malmberget 2028: the steel behind the schedule\n2. Keep what works. Compare what’s possible.\n3. {{senderFullName}}. {{senderCompany}}\n4. If everything is on track, why talk?\n5. Malmberget 2028: another success story?');
 assert.deepEqual(M.professionalSubjects.map(t=>t.pattern),['A practical idea for {{buyerCompany}}','Regarding {{verifiedProjectOrExpansion}}','An opportunity to {{supportedBenefit}}','Could this help {{buyerCompany}}?','{{senderFullName}}. {{senderCompany}}']);
});
test('older approved selections migrate without consuming a personal slot, personal subjects stay intact',()=>{
 for(const [mode,id,subject] of [['professional','development','Regarding {{development}}'],['professional','benefit','An opportunity to {{value}}'],['friendly','partnership','{{company}}. A long-term partnership?'],['brutal','fit','{{buyerCompany}} — fit: {{fitScore}}/100']]){
  const core=M.defaults.find(t=>t.id===mode),s=M.normalize({version:5,mode,templates:[{...core,subject}]});
  assert.equal(s.subjectChoices[mode],id);assert.deepEqual(s.myTemplates,{});
  const reloaded=M.normalize(JSON.parse(JSON.stringify(M.storageState(s))));assert.equal(reloaded.subjectChoices[mode],id);
 }
 const personal=M.saveMyTemplate({},'template-1',{name:'My exact subject',subject:'Keep this exact wording',body:'My own message'});
 assert.equal(M.normalize(personal).myTemplates['template-1'].subject,'Keep this exact wording');
});
test('approved fit aliases use only the real current score and active sender',()=>{
 const essentials={sender:'Alex Smith',company:'LegalCo',calendly:'https://calendly.com/example/meeting'};
 const s=M.saveMyTemplate(M.normalize({},essentials),'template-1',{subject:'{{recipientCompany}} — fit: {{fitScore}}/100. {{senderFullName}}. {{senderCompany}}',body:'My own message'});s.mode='template-1';
 const p=JSON.parse(M.prompt(s,{buyerCompany:'ClientCo',fitScore:67}).prompt);
 assert.equal(p.authoritativeSubject,'ClientCo — fit: 67/100. Alex Smith. LegalCo');
 assert.doesNotMatch(JSON.stringify(p),/Malmberget|ERCON|Edgars/);
 assert.match(M.prompt(s).system,/Preserve all literal wording and punctuation/);
});
