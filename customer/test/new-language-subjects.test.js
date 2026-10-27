const test=require('node:test'),assert=require('node:assert/strict'),S=require('../message-studio.js'),E=require('../message-evidence.js');
test('new market languages have native subject order and retain protected fact slots',()=>{
 assert.equal(S.subjectPattern('professional','relevance','tr'),'{{subjectProject}} için {{subjectOffer}}');
 assert.equal(S.subjectPattern('professional','curiosity','tr'),'{{supplierType}} için bir yer daha var mı?');
 for(const [language,curiosity] of [['zh-CN','还能增加一家{{supplierType}}吗？'],['zh-TW','還能增加一家{{supplierType}}嗎？']]){
  assert.equal(S.subjectPattern('professional','relevance',language),'面向{{subjectProject}}的{{subjectOffer}}');
  assert.equal(S.subjectPattern('professional','curiosity',language),curiosity);
 }
});
test('new languages use localized neutral context and a question rather than invented project facts',()=>{
 const expected={tr:['Planlarınız','şimdi mi sonra mı karşılaştıralım'],'zh-CN':['您的计划','现在比较还是以后比较'],'zh-TW':['您的計畫','現在比較還是以後比較']};
 for(const [language,[label,timing]] of Object.entries(expected)){
  assert.equal(E.neutralContext[language],label);assert.equal(E.comparison({}, {},language).text,timing);
  const studio=S.chooseSubject(S.normalize({mode:'professional'},{language}),'professional','benefit');
  assert.equal(S.resolvedSubject(studio,{subjectLanguage:language},{language}),label+': '+timing+'?');
 }
});
