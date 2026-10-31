const test=require('node:test'),assert=require('node:assert/strict');
const S=require('../message-studio'),E=require('../message-editor'),A=require('../approved-reference-scripts');
const source=require('./fixtures/approved-core-masters-2026-10-17.json');
const seller='A Latvian steel fabrication and installation company specialising in the Scandinavian market. More than 30 years in steel. We turn drawings into steel structures and platforms. Reliable partnership, consistent quality and controlled costs.';
const essentials={sender:'Edgars Untals',company:'ERCON',offer:'steel fabrication and installation',difference:'More than 30 years in steel.',value:'reliable partnership, consistent quality and controlled costs',meetingValue:'production data and lessons from comparable projects',proof:'https://seller.example/projects',calendly:'https://calendly.com/seller/intro'};
const context={channel:'email',firstName:'Joakim',buyerName:'Joakim Winsa',buyerCompany:'LKAB',sellerWebsite:'https://seller.example/',sellerEvidence:[{url:'https://seller.example/about',text:seller,extracted:true}],trigger:{verification:'source_verified',url:'https://buyer.example/plant',summary:'Foundation work in Malmberget is under way.',excerpt:source.curiosity.paragraphs[1]+' '+source.friendly.paragraphs[1]+' LKAB directly or through NCC.',positive:true}};
test('Professional emitted body preserves the approved introduction and bid request rather than substituting Profile prose',()=>{
 const draft=E.tailor(S.normalize({mode:'professional',essentials}),context);
 assert.match(draft.message,/I’m Edgars Untals from ERCON, a Latvian steel fabrication and installation company\./);
 assert.match(draft.message,/bidder for steel structures, platforms or installation work on your new Malmberget plant\./);
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

test('template factual slots use the full selected project evidence instead of only its one-sentence trigger',()=>{
 const short={...context,trigger:{...context.trigger,summary:'LKAB announced an investment in a new sorting plant at Malmberget.',excerpt:'LKAB announced an investment in a new sorting plant at Malmberget.'},buyerDomain:'buyer.example',buyerFactEvidence:[{sourceRead:true,url:'https://buyer.example/plant',title:'Malmberget sorting plant',text:'LKAB announced an investment in a new sorting plant at Malmberget. Foundation work is under way. The sorting plant is scheduled to open in 2028.',verification:'source_verified'}]};
 const draft=E.tailor(S.normalize({mode:'curiosity',essentials}),short);
 assert.match(draft.message,/Foundation work in Malmberget is under way\. The new sorting plant is due to run in 2028\./);
 assert.doesNotMatch(draft.message,/\[Add verified (milestone|project-type|opening-year)\]/);
});
test('missing mandatory atoms remain research gaps rather than being treated as complete subject preparation',()=>{
 const sparse={...context,trigger:{...context.trigger,summary:'LKAB announced an investment in a new sorting plant at Malmberget.',excerpt:'LKAB announced an investment in a new sorting plant at Malmberget.'}};
 assert.deepEqual(E.coreFactGaps(S.normalize({mode:'curiosity',essentials}),sparse),['milestoneWork','openingYear']);
 const unrelated={...sparse,buyerDomain:'buyer.example',buyerFactEvidence:[{sourceRead:true,url:'https://buyer.example/other',title:'Northport warehouse',text:'Foundation work in Northport is under way. The new warehouse is due to open in 2031.',verification:'source_verified'},{url:'https://unrelated.example/plant',title:'Malmberget',text:'Foundation work in Malmberget is under way. The sorting plant is due to run in 2040.',verification:'source_verified'}]};
 assert.deepEqual(E.coreFactGaps(S.normalize({mode:'curiosity',essentials}),unrelated),['milestoneWork','openingYear']);
});

test('an official project article keeps factual detail across separate source paragraphs',()=>{const scoped={...context,buyerDomain:'buyer.example',trigger:{...context.trigger,summary:'LKAB announced an investment in a new sorting plant at Malmberget.',excerpt:'LKAB announced an investment in a new sorting plant at Malmberget.'},buyerFactEvidence:[{sourceRead:true,url:context.trigger.url,title:'Milestone: company lays the foundation for the future',text:'LKAB announced an investment in a new sorting plant at Malmberget.\n\nFoundation work is under way.\n\nThe plant is scheduled to open in 2028.'}]};assert.doesNotMatch(E.tailor(S.normalize({mode:'curiosity',essentials}),scoped).message,/\[Add verified (milestone|project-type|opening-year)\]/);});

test('validated English field preparation fills factual atoms from Swedish source evidence',()=>{const studio=S.normalize({mode:'curiosity',essentials}),swedish={...context,trigger:{...context.trigger,summary:'LKAB satsar på ett nytt sovringsverk i Malmberget.',excerpt:'LKAB satsar på ett nytt sovringsverk i Malmberget.'}},fields={...E.fieldSources(studio,swedish),triggerSummary:'LKAB is investing in a new sorting plant in Malmberget.'};const prepared=E.preparedResponse(fields,studio,swedish),draft=E.tailor(studio,E.preparedContext(studio,swedish,prepared));assert.match(draft.message,/The new sorting plant is due to run in/);assert.doesNotMatch(draft.message,/\[Add verified project-type\]/);assert.match(draft.message,/\[Add verified opening-year\]/);});
