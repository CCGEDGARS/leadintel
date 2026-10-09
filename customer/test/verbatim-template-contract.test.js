const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const S=require('../message-studio.js'),E=require('../message-editor.js'),A=require('../approved-reference-scripts.js');
const essentials={sender:'Alex Lane',company:'SellerCo',offer:'manufacturing and installation',value:'simplify delivery and control costs',difference:'Our team brings extensive manufacturing experience.',approach:'Delivery and installation.',meetingValue:'relevant project data and lessons',calendly:'https://calendly.com/alex/intro',language:'en'};
const context={channel:'email',firstName:'Robin',buyerName:'Robin',buyerCompany:'BuyerCo',trigger:{url:'https://buyer.test/news',verification:'source_verified',summary:'BuyerCo’s new sorting plant'}};
test('Professional uses the precise approved wording with factual substitutions only',()=>{
 const s=S.normalize({mode:'professional',essentials}),draft=E.tailor(s,context);
 assert.equal(draft.message,[
 'Hi Robin,',
 'I noticed BuyerCo’s new sorting plant. Keeping a project of that scale running smoothly can take considerable time and effort.',
 'Does your role involve finding trusted partners and managing suppliers for this project?',
 "By the way, I'm Alex Lane from SellerCo.",
 'Our team brings extensive manufacturing experience. We provide manufacturing and installation.',
 'SellerCo focus is straightforward: consistent quality, controlled costs and reliable delivery.',
 'Here are some of the projects we are proud of: [link].',
 'Would you be open to a 20-minute Zoom call?',
 'The goal is to explore whether our approach could help your team reduce costs, simplify project management and keep production plans on track.',
 'I’d like to share relevant production data and lessons from previous projects, then compare your requirements with what we can offer. Together, we can identify where our cooperation could bring the most value to your team.',
 'Please choose a suitable time here: https://calendly.com/alex/intro.',
 'Best regards,\nAlex'
 ].join('\n\n'));
});
test('every core style stays within its approved original word frame and keeps twenty minutes',()=>{
 for(const mode of ['professional','curiosity','friendly','brutal']){
 const original=A.originalText(mode),s=S.normalize({mode,essentials}),draft=E.tailor(s,context);
 assert.match(draft.message,/20-minute/);assert.doesNotMatch(draft.message,/30-minute|\{\{|ERCON|LKAB|Joakim|2028/);
 assert.ok(draft.message.split(/\s+/).length<=A.records[mode].paragraphs.join(' ').split(/\s+/).length);
 assert.equal(A.originalText(mode),original);
 assert.throws(()=>E.validateFrame('word '.repeat(250),mode),/approved original length/);
 }
});
test('research proof prose and certification lists cannot spill into the protected script',()=>{
 const s=S.normalize({mode:'professional',essentials:{...essentials,proof:'Company reports 30 years. ISO 9001:2015. Here is evidence https://seller.test/projects'}});
 const d=E.tailor(s,context);assert.match(d.message,/Here are some of the projects we are proud of: https:\/\/seller.test\/projects/);
 assert.doesNotMatch(d.message,/Company reports|ISO 9001|30 years/);
});
test('factual field word limits reject expansion and cached facts are scoped to the style',()=>{
 const s=S.normalize({mode:'professional',essentials}),fields={triggerSummary:context.trigger.summary,offer:essentials.offer,value:essentials.value,difference:essentials.difference,approach:essentials.approach,meetingValue:essentials.meetingValue};
 assert.throws(()=>E.parsePrepared({...fields,offer:'word '.repeat(13)},s,context),/concise English fields/);
 const prepared=E.parsePrepared(fields,s,context);assert.throws(()=>E.preparedContext(S.normalize({mode:'friendly',essentials}),context,prepared),/changed/);
});
test('manual edits, rewrites and CRM-shaped reload preserve the first tailored original',()=>{
 const s=S.normalize({mode:'professional',essentials}),draft=E.tailor(s,context),key=E.scope('workspace',{channel:'email'},s,context);
 let item=E.apply({channel:'email',drafts:{}},draft,{original:true,key});
 item=E.apply(item,{subject:draft.subject,message:'Manual changes'});
 item=E.apply(item,{subject:draft.subject,message:'Explicit rewritten preview'},{origin:'rewrite'});
 item=JSON.parse(JSON.stringify(item));assert.equal(E.original(item,key).message,draft.message);assert.equal(item.drafts.emailBody,'Explicit rewritten preview');
});

test('the user-pasted Professional master is exact after identity and link substitutions',()=>{
 const e={...essentials,sender:'Edgars Untāls',company:'ERCON',offer:'drawing development, metal manufacturing, installation and qualified workforce solutions',difference:'Our team brings more than 30 years of metalworking experience, including international projects in Scandinavia.',proof:'https://seller.test/approved-projects',value:'A long unrelated value proposition '.repeat(20),meetingValue:'A long repeated meeting purpose '.repeat(20),approach:'Another long irrelevant delivery list '.repeat(20),calendly:'https://calendly.com/edgars-7go/strategy-call'};
 const ctx={...context,firstName:'Joakim',buyerName:'Joakim Winsa',buyerCompany:'LKAB',trigger:{...context.trigger,summary:'LKAB’s investment in the new sorting plant in Malmberget'}};
 const studio=S.normalize({mode:'professional',essentials:e});assert.equal(E.needsPreparation(studio,ctx),false);
 const confirmed=fs.readFileSync(path.join(__dirname,'fixtures/approved-professional-user-2026-10-09.txt'),'utf8').trim();assert.equal(A.records.professional.paragraphs.map(p=>p.trim()).join('\n\n'),confirmed);
 const expected=confirmed.replace('(First name Second name)',e.sender).replace('[link]','https://seller.test/approved-projects').replace('[Calendly link]',e.calendly);
 const draft=E.tailor(studio,ctx);assert.equal(draft.message,expected);assert.equal(S.defaults.find(t=>t.id==='professional').body,A.professionalPattern());E.validateFrame(draft.message,'professional');
 assert.doesNotMatch(draft.message,/ISO|integrated offering|unrelated|repeated|irrelevant/);
});
test('Professional goal, focus and meeting purpose cannot be replaced by prepared profile content',()=>{
 const studio=S.normalize({mode:'professional',essentials});const prepared=E.parsePrepared({triggerSummary:context.trigger.summary,offer:essentials.offer,difference:essentials.difference,value:'simplify delivery',approach:'Extra capabilities.',meetingValue:'a repeated purpose'},studio,context);
 const draft=E.tailor(studio,E.preparedContext(studio,context,prepared));assert.match(draft.message,/consistent quality, controlled costs and reliable delivery/);assert.match(draft.message,/reduce costs, simplify project management and keep production plans on track/);assert.doesNotMatch(draft.message,/Extra capabilities|a repeated purpose/);
});

test('missing project references retain the approved reference line without invented links',()=>{
 const studio=S.normalize({mode:'professional',essentials:{...essentials,proof:''}}),draft=E.tailor(studio,context);
 assert.match(draft.message,/Here are some of the projects we are proud of: \[link\]\./);
 assert.doesNotMatch(draft.message,/ercon\.lv|invented/);
});

test('translation of one field cannot paraphrase other already-valid approved factual fields',()=>{
 const e={...essentials,offer:'drawing development, metal manufacturing, installation and qualified workforce solutions',difference:'Our team brings more than 30 years of metalworking experience, including international projects in Scandinavia.'};
 const ctx={...context,trigger:{...context.trigger,summary:'LKAB satsar sex miljarder på ett nytt sovringsverk vid Malmbergsgruvan.'}},studio=S.normalize({mode:'professional',essentials:e});
 const result=E.preparedResponse({triggerSummary:'LKAB’s investment in the new sorting plant in Malmberget',offer:'custom manufacturing and installation',difference:'Our team has international experience.',value:'',approach:'',meetingValue:''},studio,ctx);
 assert.equal(result.fields.offer,e.offer);assert.equal(result.fields.difference,e.difference);
 const draft=E.tailor(studio,E.preparedContext(studio,ctx,result));assert.match(draft.message,/Scandinavia/);assert.match(draft.message,/qualified workforce solutions/);assert.doesNotMatch(draft.message,/Our team has international experience/);
 assert.throws(()=>E.preparedResponse({...result.fields,message:'Unapproved entire body'},studio,ctx),/unapproved field/);
});


test('Professional preparation shares the actual remaining word budget across factual fields',()=>{
 const e={...essentials,sender:'Edgars Untāls',company:'ERCON',difference:'Our team brings more than 30 years of metalworking experience, including international projects in Scandinavia.',offer:'Drawing development, prototyping, serial production, custom manufacturing, metal structures and equipment installation, surface treatment, welded-joint testing, delivery and qualified workforce solutions'};
 const ctx={...context,firstName:'Joakim',buyerCompany:'LKAB',trigger:{...context.trigger,summary:'LKAB satsar sex miljarder på ett nytt sovringsverk vid Malmbergsgruvan.',subjectSummary:'LKAB announced an investment in a new sorting plant at Malmberget.'}},studio=S.normalize({mode:'professional',essentials:e});
 const limits=E.preparationWordLimits(studio,ctx),prompt=JSON.parse(E.preparationPrompt(studio,ctx).prompt);
 assert.deepEqual(prompt.wordLimits,limits);assert.equal(limits.difference,e.difference.split(/\s+/).length);assert.ok(limits.offer<12);assert.ok(limits.triggerSummary<14);
 const fields={triggerSummary:'LKAB’s investment in a new Malmberget sorting plant',offer:'drawing development, metal manufacturing, installation and qualified workforce solutions',difference:'Our team has international experience.',value:'',approach:'',meetingValue:''};
 const prepared=E.preparedResponse(fields,studio,ctx),draft=E.tailor(studio,E.preparedContext(studio,ctx,prepared));
 assert.match(draft.message,/Scandinavia/);E.validateFrame(draft.message,'professional');
 assert.throws(()=>E.parsePrepared({...prepared.fields,triggerSummary:'word '.repeat(limits.triggerSummary+1).trim()},studio,ctx),/concise English fields/);
});
