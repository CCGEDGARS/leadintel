const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../approved-reference-scripts'),S=require('../message-studio'),E=require('../message-editor');
const source=require('./fixtures/approved-core-masters-2026-10-15.json');
const essentials={sender:'Alex Lane',company:'North Works',offer:'steel fabrication and installation',value:'reliable partnership, consistent quality and controlled costs',difference:'Our team has 30 years of steel fabrication experience.',meetingValue:'production data and lessons from comparable projects',proof:'https://north.example/projects',calendly:'https://calendly.com/north/intro',language:'en'};
const context={channel:'email',firstName:'Robin',buyerName:'Robin Buyer',buyerCompany:'Buyer',sellerWebsite:'https://north.example/',senderLinkedInUrl:'https://www.linkedin.com/in/alexlane/',trigger:{verification:'source_verified',url:'https://buyer.example/news',summary:'Buyer is investing in a sorting plant at Northport.',positive:true}};
test('all four October 15 originals preserve every paragraph and internal line break',()=>{
 for(const [style,record] of Object.entries(source))assert.equal(A.originalText(style),record.paragraphs.join('\n\n'),style);
});
test('four style generators use their October 15 pattern without legacy replacement errors',()=>{
 for(const mode of Object.keys(source)){
  const studio=S.normalize({mode,essentials}),draft=E.tailor(studio,context);
  assert.match(draft.message,/^Hi Robin,\n\n/);assert.match(draft.message,/Alex Lane\nNorth Works\nhttps:\/\/north\.example\//);
  assert.doesNotMatch(draft.message,/ERCON|Edgars|Malmberget|LKAB|NCC|2028|Latvian|Scandinavian|Arctic/);
  assert.ok(draft.message.includes(essentials.calendly));
 }
});
test('other industries cannot inherit example industry, experience, milestones or certificates',()=>{
 for(const mode of Object.keys(source)){
  const studio=S.normalize({mode,essentials:{...essentials,company:'Legal North',offer:'commercial contract review',difference:'Our team provides contract advice.',value:'clear advice',proof:''}});
  const draft=E.tailor(studio,{...context,trigger:null});
  assert.doesNotMatch(draft.message,/steel|fabrication|30 years|EN 1090|EXC3|ISO 3834|2028|NCC|Latvian|Scandinavian|Malmberget|LKAB/i);
  assert.match(draft.message,/Legal North/);
 }
});
test('new masters remain immutable through normalize and CRM working-copy restore',()=>{
 const O=require('../outreach-engine'),before=JSON.stringify(A.records);
 for(const mode of Object.keys(source)){
  const studio=S.normalize({mode,essentials}),draft=E.tailor(studio,context),item=E.apply({domain:'buyer.example',channel:'email',drafts:{}},draft,{original:true,key:'new-master',style:mode,origin:'tailored'});
  const manual=E.apply(item,{subject:draft.subject,message:'My preserved working copy'}),saved=O.restoreCrmScriptSnapshot(O.buildCrmScriptSnapshot(manual),'buyer.example');
  assert.equal(saved.drafts.emailBody,'My preserved working copy');assert.equal(E.original(saved,'new-master').message,draft.message);
 }
 assert.equal(JSON.stringify(A.records),before);
});
