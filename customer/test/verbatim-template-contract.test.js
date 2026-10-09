const {test}=require('node:test'),assert=require('node:assert/strict');
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
 'SellerCo focus is straightforward: simplify delivery and control costs.',
 'If this is relevant for BuyerCo’s new sorting plant, would you be open to a 20-minute Zoom call?',
 'The goal is to explore whether our approach could help your team simplify delivery and control costs.',
 'I’d like to share relevant project data and lessons, then compare your requirements with what we can offer. Together, we can identify where our cooperation could bring the most value to your team.',
 'Please choose a suitable time here: https://calendly.com/alex/intro.',
 'Best regards,\nAlex Lane'
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
 assert.throws(()=>E.parsePrepared({...fields,meetingValue:'word '.repeat(13)},s,context),/concise English fields/);
 const prepared=E.parsePrepared(fields,s,context);assert.throws(()=>E.preparedContext(S.normalize({mode:'friendly',essentials}),context,prepared),/changed/);
});
test('manual edits, rewrites and CRM-shaped reload preserve the first tailored original',()=>{
 const s=S.normalize({mode:'professional',essentials}),draft=E.tailor(s,context),key=E.scope('workspace',{channel:'email'},s,context);
 let item=E.apply({channel:'email',drafts:{}},draft,{original:true,key});
 item=E.apply(item,{subject:draft.subject,message:'Manual changes'});
 item=E.apply(item,{subject:draft.subject,message:'Explicit rewritten preview'},{origin:'rewrite'});
 item=JSON.parse(JSON.stringify(item));assert.equal(E.original(item,key).message,draft.message);assert.equal(item.drafts.emailBody,'Explicit rewritten preview');
});
