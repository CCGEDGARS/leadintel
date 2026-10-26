const test=require('node:test'),assert=require('node:assert/strict');
const I=require('../linkedin-inmail-engine.js'),A=require('../approved-linkedin-inmail.js');
const row=style=>A.records.find(r=>r.style===style);
test('InMail NLP preserves its approved opening and experience frames despite legacy paragraph fields',()=>{
 const d=I.prepare(row('curiosity'),{development:'Generic investment summary.',experience:'Generic company pitch.',deliveryRequirement:'A generic promise.',milestoneWork:'Foundation work',projectShortName:'Malmberget',projectType:'plant',projectYear:'2028',deliveryItem:'steel structure',experienceDuration:'30+ years',experienceIndustry:'steel',experienceMarket:'Scandinavia'});
 const blocks=d.stages.initial.message.split('\n\n');
 assert.equal(blocks[1],row('curiosity').stages[0].originalBody.split('\n\n')[1]);
 assert.match(blocks[2],/30\+ years in steel, specialising in Scandinavia\./);
 assert.doesNotMatch(d.stages.initial.message,/Generic|generic/);
});
test('InMail Friendly preserves the congratulations and lived experience frames',()=>{
 const d=I.prepare(row('friendly'),{development:'Generic announcement.',experienceSentence:'Generic experience.',projectShortName:'Malmberget',milestoneActivity:'foundations',projectRegion:'North of the Arctic Circle',projectYear:'2028',experienceDuration:'30+ years',experienceOutcome:'steel that arrives on time and fits'});
 assert.equal(d.stages.initial.message.split('\n\n')[1],row('friendly').stages[0].originalBody.split('\n\n')[1]);
 assert.match(d.stages.initial.message,/For 30\+ years we’ve done the less glamorous part of projects like yours: steel that arrives on time and fits\./);
 assert.doesNotMatch(d.stages.initial.message,/Generic/);
});
test('every InMail style and all follow-ups keep literals and unresolved fields instead of borrowing example facts',()=>{
 for(const r of A.records){
  if(r.style!=='storyselling')assert.doesNotMatch(JSON.stringify(r.stages),/\{\{(?:development|experienceSentence|experience|deliveryRequirement)\}\}/);
  const d=I.prepare(r,{firstName:'Alice',sender:'Robin',company:'Different business'});
  assert.deepEqual(Object.keys(d.stages),I.stages);
  assert.match(d.stages.initial.message,/\{\{/);
  assert.doesNotMatch(JSON.stringify(d.stages),/Malmberget|ERCON|2028|Joakim/);
  assert.ok(I.copyErrors(d,'initial').length);
 }
});
test('a legacy core sequence cannot be copied as a refreshed mandatory script; manual and personal copies retain authority',()=>{
 const d=I.prepare(row('professional'),{});delete d.sourcePatternVersion;
 assert.ok(I.copyErrors(d,'initial').some(s=>/Apply facts.*updated/i.test(s)));
 d.origin='manual';assert.ok(!I.copyErrors(d,'initial').some(s=>/Apply facts.*updated/i.test(s)));
 d.origin='core';d.sourceId='personal-one';assert.ok(!I.copyErrors(d,'initial').some(s=>/Apply facts.*updated/i.test(s)));
});
