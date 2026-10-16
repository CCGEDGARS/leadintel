const test=require('node:test'),assert=require('node:assert/strict');
const S=require('../message-studio'),E=require('../message-editor'),A=require('../approved-reference-scripts');
const source=require('./fixtures/approved-core-masters-2026-10-15.json');
const seller='A Latvian steel fabrication and installation company specialising in the Scandinavian market. More than 30 years in steel. We turn drawings into steel structures and platforms. Reliable partnership, consistent quality and controlled costs.';
const essentials={sender:'Edgars Untals',company:'ERCON',offer:'steel fabrication and installation',difference:'More than 30 years in steel.',value:'reliable partnership, consistent quality and controlled costs',meetingValue:'production data and lessons from comparable projects',proof:'https://seller.example/projects',calendly:'https://calendly.com/seller/intro'};
const context={channel:'email',firstName:'Joakim',buyerName:'Joakim Winsa',buyerCompany:'LKAB',sellerWebsite:'https://seller.example/',sellerEvidence:[{url:'https://seller.example/about',text:seller,extracted:true}],trigger:{verification:'source_verified',url:'https://buyer.example/plant',summary:'Foundation work in Malmberget is under way.',excerpt:source.curiosity.paragraphs[1]+' '+source.friendly.paragraphs[1]+' LKAB directly or through NCC.',positive:true}};
test('Professional emitted body preserves the approved introduction and bid request rather than substituting Profile prose',()=>{
 const draft=E.tailor(S.normalize({mode:'professional',essentials}),context);
 assert.match(draft.message,/I’m Edgars Untals from ERCON, a Latvian steel fabrication and installation company specialising in the Scandinavian market\./);
 assert.match(draft.message,/bidder for steel structures, platforms or installation work on the Malmberget sorting plant, either with LKAB directly or through NCC\./);
 assert.doesNotMatch(draft.message,/a company providing|the Malmberget project/);
});
test('NLP uses the supplied master event frame when all facts are verified',()=>{
 const draft=E.tailor(S.normalize({mode:'curiosity',essentials}),context);
 assert.ok(draft.message.includes(source.curiosity.paragraphs[1]));
 assert.ok(draft.message.includes(source.curiosity.paragraphs[2]));
 assert.match(draft.message,/before the steel packages go out/);
});
test('Friendly preserves the approved experience voice and conditional offer',()=>{
 const draft=E.tailor(S.normalize({mode:'friendly',essentials:{...essentials,meetingValue:'real numbers and a few lessons we learned the hard way'}}),context);
 assert.ok(draft.message.includes(source.friendly.paragraphs[1]));
 assert.ok(draft.message.includes(source.friendly.paragraphs[2]));
 assert.match(draft.message,/for fabrication or installation would make your next two years a little calmer/);
});
test('Brutal preserves the source discovery, description and three supported values',()=>{
 const draft=E.tailor(S.normalize({mode:'brutal',essentials}),context);
 assert.ok(draft.message.includes(source.brutal.paragraphs[2]));
 assert.ok(draft.message.includes(source.brutal.paragraphs[3]));
 assert.ok(draft.message.includes(source.brutal.paragraphs[5]));
});
test('unsupported example details are omitted or visibly unresolved for a different seller and project',()=>{
 for(const mode of ['professional','curiosity','friendly','brutal']){
  const studio=S.normalize({mode,essentials:{...essentials,sender:'Taylor Quinn',company:'Legal North',offer:'contract review',difference:'Legal advisory services',value:'clear advice'}});
  const draft=E.tailor(studio,{...context,sellerEvidence:[],firstName:'Alex',buyerName:'Alex',buyerCompany:'Other Buyer',trigger:{verification:'source_verified',url:'https://buyer.example/news',summary:'Other Buyer expanded its office at Northport.',excerpt:'Other Buyer expanded its office at Northport.',positive:true}});
  assert.doesNotMatch(draft.message,/ERCON|Edgars|LKAB|Malmberget|2028|NCC|Latvian|Scandinavian|30 years|steel|foundation|Arctic/i);
 }
});
test('source originals remain exact after field preparation and regeneration',()=>{
 for(const style of Object.keys(source))assert.equal(A.originalText(style),source[style].paragraphs.join('\n\n'));
});

test('changing source voice facts invalidates prepared fields even when capability flags stay equal',()=>{
 const studio=S.normalize({mode:'curiosity',essentials}),changed={...context,sellerEvidence:[{...context.sellerEvidence[0],text:seller.replace('Latvian','Swedish')}]};
 assert.notEqual(E.preparedResponse(E.fieldSources(studio,context),studio,context).source,E.preparedResponse(E.fieldSources(studio,changed),studio,changed).source);
 assert.notEqual(E.scope('w1',{},studio,context),E.scope('w1',{},studio,changed));
});
