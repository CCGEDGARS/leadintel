const test=require('node:test'),assert=require('node:assert/strict');
const S=require('../message-studio'),E=require('../message-editor'),A=require('../approved-reference-scripts');
const {mounted}=require('./helpers/message-runtime');
const essentials={sender:'Edgars Untals',company:'ERCON',offer:'steel fabrication and installation',difference:'More than 30 years in steel.',value:'reliable partnership, consistent quality and controlled costs',meetingValue:'production data and lessons from comparable projects',calendly:'https://calendly.com/seller/intro'};
const context={channel:'email',firstName:'Joakim',buyerName:'Joakim Winsa',buyerCompany:'LKAB',sellerWebsite:'https://seller.example/',trigger:{verification:'source_verified',url:'https://buyer.example/plant',summary:'LKAB announced an investment in a new sorting plant at Malmberget.',excerpt:'LKAB announced an investment in a new sorting plant at Malmberget.',positive:true}};
function rendered(mode,ctx=context){const studio=S.normalize({mode,essentials});return E.tailor(studio,E.preparedContext(studio,ctx,E.preparedResponse({...E.fieldSources(studio,ctx),triggerSummary:'LKAB is investing in a new sorting plant.'},studio,ctx))).message;}
test('the screenshot case retains NLP sentence structure and flags missing facts instead of substituting an AI paragraph',()=>{
 const message=rendered('curiosity'),opening=message.split('\n\n')[1];
 assert.equal(opening,'[Add verified milestone] in Malmberget is under way. The new sorting plant is due to run in [Add verified opening-year]. And somewhere between those two dates, every steel structure has to arrive on time, fit the first time and stay within budget.');
 assert.doesNotMatch(opening,/LKAB is investing|stable, efficient production/);
});
test('core opening patterns expose factual atoms, never an entire replaceable paragraph',()=>{
 for(const style of ['curiosity','friendly','brutal'])assert.doesNotMatch(A.approvedPattern(style),/\{\{(?:development|friendlyOpening|coreExperience)\}\}/);
});
test('Brutal cannot substitute the whole discovery paragraph when milestone evidence is absent',()=>{
 const opening=rendered('brutal').split('\n\n')[2];
 assert.match(opening,/Malmberget’s new sorting plant came up\./);
 assert.match(opening,/\[Add verified milestone\] is under way, the plant is due to run in \[Add verified opening-year\]/);
 assert.match(opening,/a lot of steel has to arrive on time and fit before then\./);
});
test('Friendly keeps its experience frame even when facts are missing',()=>{
 const studio=S.normalize({mode:'friendly',essentials:{...essentials,offer:'contract review',difference:'Legal advisory services'}}),ctx={...context,buyerCompany:'Other Buyer',sellerEvidence:[]};
 const message=E.tailor(studio,ctx).message;
 assert.match(message,/For \[Add verified experience-duration\] we’ve worked on the less glamorous part of projects like yours: \[Add verified experience-outcome\]\./);
 assert.doesNotMatch(message,/30 years|steel|ERCON is|Foundation work/);
});
test('negated, historical or speculative source clauses cannot establish an active milestone or opening year',()=>{
 for(const excerpt of ['Foundation work in Malmberget has not started. The new sorting plant is not due to run in 2028.','Foundation work in Malmberget could start. The new sorting plant might be due to run in 2028.']){
 const text=rendered('curiosity',{...context,trigger:{...context.trigger,summary:excerpt,excerpt,positive:false}});
 assert.match(text,/\[Add verified milestone\]/);assert.match(text,/\[Add verified opening-year\]/);assert.doesNotMatch(text,/Foundation work in|due to run in 2028/);
 }
});
test('a legacy generic working draft is marked noncanonical and cannot be accepted as a core source',()=>{
 const h=mounted({selected:'curiosity'});try{const studio=h.w.studioState(),ctx=h.w.studioMessageContext();const message=rendered('curiosity');assert.throws(()=>E.validateCoreDraft(studio,ctx,{subject:'A subject',message:message.replace(/\[Add verified milestone\][^.]+\./,'LKAB is investing in a new plant.')}),/differs from the approved/);}finally{h.w.close();}
});
test('runtime refuses a core pattern that reintroduces a whole-paragraph slot',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),module={exports:{}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../message-editor'),'utf8'),{module,require:name=>name==='./message-studio.js'?S:{...A,approvedPattern:()=> 'Hi {{firstName}},\n\n{{development}}'}});
 assert.throws(()=>module.exports.referencePattern('curiosity'),/Core paragraph slots are forbidden/);
});
test('an incomplete project opening uses its declared omission and the exact working copy survives reopen',()=>{
 const h=mounted({selected:'curiosity'});try{h.q('message-generate').click();assert.doesNotMatch(h.q('outreach-email-body').value,/\[Add verified (?:milestone|opening-year)\]/);assert.equal(h.q('mw-add-flow').disabled,true);const snapshot=JSON.parse(h.w.localStorage.getItem('leadintel_customer_v2_outreach')),r=mounted({outreachSnapshot:snapshot});try{assert.equal(r.q('outreach-email-body').value,h.q('outreach-email-body').value);assert.equal(r.q('mw-add-flow').disabled,true);}finally{r.w.close();}}finally{h.w.close();}
});
test('official milestone wording fills factual atoms without composing a new paragraph',()=>{
 // LKAB press release 2026-08-25: /en/press/milestone-lkab-lays-the-foundation-for-gallivares-future/
 const excerpt='LKAB is now laying the foundation for the new sorting plant at the mine in Malmberget, Gällivare – marking an important milestone in securing the company’s continued operations. When it becomes operational in 2028, it will be one of the largest facilities in LKAB’s history.';
 const message=rendered('curiosity',{...context,trigger:{...context.trigger,excerpt}});
 assert.equal(message.split('\n\n')[1],require('./fixtures/approved-core-masters-2026-10-17.json').curiosity.paragraphs[1]);
});
test('the separate opening-only action cannot bypass the native core frame',()=>{
 const h=mounted({selected:'curiosity'});try{h.q('message-generate').click();const before=h.q('outreach-email-body').value;h.w.updateMessageOpening();assert.equal(h.q('outreach-email-body').value,before);assert.match(h.q('message-fact-status').textContent,/Use Update message.*approved core opening/);}finally{h.w.close();}
});
