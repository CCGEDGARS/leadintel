const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const S=require('../message-studio.js'),C=require('../company-research-engine.js'),F=require('../first-party-research.js'),Facts=require('../message-facts.js');
const trigger={url:'https://buyer.example/news',verification:'source_verified',excerpt:'A new plant is being built in Northport.',summary:'A new plant is being built in Northport.'};
const essentials={sender:'Alex Morgan',company:'North Works',offer:'design, installation',difference:'Our team has delivered industrial projects.',proof:'',calendly:'https://calendly.com/north/intro',language:'en'};
function fifth(e=essentials,context={}){const st=S.normalize({mode:'professional',subjectChoices:{professional:'benefit'},essentials:e});return S.subjectAudit(st,{buyerCompany:'Buyer',trigger,...context}).rows[4];}
function contract(){assert.ok(fs.existsSync(require.resolve('../message-studio.js').replace('message-studio.js','message-evidence.js')),'Shared message evidence contract must exist');return require('../message-evidence.js');}
test('the fifth subject uses a relevant service comparison without technical evidence',()=>{
 const row=fifth();assert.equal(row.ready,true);assert.equal(row.subject,'Northport: design or installation?');
});
test('one execution class or EN 1090 alone cannot invent a two-class comparison',()=>{
 for(const text of ['We manufacture steel according to EN 1090.','We manufacture steel structures to EXC2.']){
  const row=fifth({...essentials,offer:'steel'},{sellerWebsite:'https://seller.example',sellerEvidence:[{url:'https://seller.example/quality',text}]});
  assert.equal(row.ready,true);assert.equal(row.subject,'Northport: compare now or later?');
 }
});
test('two evidenced execution classes provide a question without claiming buyer requirements',()=>{
 const row=fifth({...essentials,offer:'steel'},{sellerWebsite:'https://seller.example',sellerEvidence:[{url:'https://seller.example/quality',text:'We manufacture steel structures to EXC2 and EXC3 standards.'}]});assert.equal(row.subject,'Northport: EXC2 or EXC3?');
});
test('the fifth subject remains complete for unknown, long and unrelated-industry contexts',()=>{
 for(const change of [{trigger:null},{trigger:{...trigger,shortName:'An Extremely Long Project Name With No Safe Abbreviation',summary:'',excerpt:''},buyerCompany:'A company with an extraordinarily long registered legal name'},{trigger:null,buyerCompany:''},{subjectLanguage:'lv'},{subjectLanguage:'de'}]){
  const row=fifth({...essentials,offer:'diagnostic equipment'},change);assert.equal(row.ready,true);assert.ok(Array.from(row.subject).length<=60);assert.doesNotMatch(row.subject,/EXC|steel|ERCON|Malmberget|undefined/);
 }
});
test('explicit meeting dates survive settings normalization and expire safely without changing saved drafts',()=>{
 const e={...essentials,meetingDateOne:'2026-10-12',meetingDateTwo:'2026-10-18'},st=S.normalize({mode:'professional',essentials:e});
 assert.equal(st.essentials.meetingDateOne,e.meetingDateOne);assert.ok(S.settingFields.includes('meetingDateTwo'));
 assert.equal(fifth(st.essentials,{now:'2026-10-10'}).subject,'Northport: meet 12 Oct or 18 Oct?');
 assert.doesNotMatch(fifth(st.essentials,{now:'2026-10-19'}).subject,/12 Oct|18 Oct/);
 assert.doesNotMatch(fifth({...e,meetingDateOne:'2026-02-30'},{now:'2026-01-01'}).subject,/Feb|Mar/);
});
test('one shared contract covers every approved style and separates user input from public research',()=>{
 const R=contract();for(const style of ['professional','curiosity','friendly','brutal']){
  const report=R.assess({style,essentials,context:{buyerCompany:'Buyer',buyerName:'Sam Buyer',trigger}});
  assert.ok(report.facts.some(row=>row.id==='reference'&&row.status==='missing'));
  assert.ok(report.facts.some(row=>row.id==='booking'&&row.status==='confirmed'&&row.owner==='user'));
  assert.ok(report.facts.some(row=>row.id==='project'&&row.status==='confirmed'&&row.url===trigger.url));
  assert.ok(report.facts.some(row=>row.id==='experience'));
 }
});
test('gap searches are independent, seller-scoped, bounded and do not research booking or sender identity',()=>{
 const R=contract(),plan=R.plan({style:'friendly',essentials,context:{sellerWebsite:'https://clinical.example',sellerEvidence:[],trigger}});
 assert.ok(plan.length>0&&plan.length<=3);assert.ok(plan.every(row=>row.query.startsWith('site:clinical.example')&&row.query.split(/\s+/).length<=9));
 assert.doesNotMatch(JSON.stringify(plan),/EN 1090|steel|Calendly|Alex Morgan/);
 assert.deepEqual(R.plan({essentials,context:{sellerWebsite:'javascript:alert(1)'}}),[]);
});
test('official reference evidence is reusable but snippets, failed sources and another seller never complete a field',()=>{
 const R=contract(),page={url:'https://seller.example/projects/hospital',text:'We delivered diagnostic equipment and completed installation at the hospital.',extractedAt:'2026-10-10'};
 const good=R.assess({style:'friendly',essentials,context:{sellerWebsite:'https://seller.example',sellerEvidence:[page]}}).facts.find(row=>row.id==='reference');assert.equal(good.status,'confirmed');assert.equal(good.url,page.url);assert.ok(good.excerpt);
 for(const source of [{url:page.url,description:page.text},{...page,status:'failed'},{...page,url:'https://other.example/projects/hospital'},{...page,text:'We do not provide installation or delivery services.'}])assert.equal(R.assess({essentials,context:{sellerWebsite:'https://seller.example',sellerEvidence:[source]}}).facts.find(row=>row.id==='reference').status,'missing');
});
test('Profile research explicitly discovers quality pages as well as offers and project evidence',()=>{
 const queries=C.buildAuthoritativePageQueries({website:'https://clinical.example/',companyName:'Clinical Systems'});assert.ok(queries.some(row=>row.categories.includes('technical')));assert.ok(queries.some(row=>row.query.includes('certification')));
 const selected=C.selectAuthoritativePageCandidates([{url:'https://clinical.example/quality',title:'Quality and certification'},{url:'https://clinical.example/projects',title:'Projects'}],'https://clinical.example/',8);assert.ok(selected.some(row=>row.pageCategory==='technical'));
});
test('bounded website reading reserves coverage for references and technical specifics despite many product links',()=>{
 const links=['/products/1','/products/2','/products/3','/products/4','/projects','/quality'];
 const selected=F.selectInternalLinks({links},'https://clinical.example/','company',4);assert.ok(selected.includes('https://clinical.example/projects'));assert.ok(selected.includes('https://clinical.example/quality'));
});
test('trigger research searches a reviewed project separately for location, schedule and specifications',()=>{
 const plan=Facts.queries({company:'Buyer',domain:'buyer.example'},{...essentials,offer:'diagnostic equipment'},{trigger:{...trigger,projectName:'Northport clinic'}});
 assert.ok(plan.some(row=>row.query.includes('Northport clinic')&&/schedule|specifications/.test(row.query)));assert.ok(plan.every(row=>row.domain==='buyer.example'));assert.doesNotMatch(JSON.stringify(plan),/EXC|steel/);
});
test('Profile facts retain their extracted evidence and never confuse research with user confirmation',()=>{
 const R=contract(),context={sellerWebsite:'https://seller.example',sellerEvidence:[{url:'https://seller.example/services',text:'We provide design and installation services. Our team has more than 20 years of experience.',extractedAt:'2026-10-10'}]};
 const report=R.assess({essentials:{},context}),offer=report.facts.find(row=>row.id==='offer'),experience=report.facts.find(row=>row.id==='experience');
 assert.equal(offer.status,'confirmed');assert.equal(offer.verification,'source_verified');assert.equal(offer.url,context.sellerEvidence[0].url);assert.equal(experience.status,'confirmed');
 const plan=R.plan({essentials:{},context});assert.ok(!plan.some(row=>row.fields.includes('offer')),'Known source facts must not be researched again');
});
test('upstream Profile plans use the same missing-field contract as message preparation',()=>{
 const queries=C.buildAuthoritativePageQueries({website:'https://seller.example',companyName:'Seller'});
 assert.ok(queries.some(row=>row.fields?.includes('reference')));assert.ok(queries.some(row=>row.fields?.includes('technical')));assert.ok(queries.some(row=>row.fields?.includes('offer')));
});
test('known references and certification cannot suppress research for a missing material',()=>{
 const st=S.normalize({mode:'professional',essentials}),context={sellerWebsite:'https://seller.example',trigger,sellerEvidence:[{url:'https://seller.example/projects/site',text:'We delivered machinery and completed installation. Our company holds quality certification.'}]};
 assert.ok(S.subjectResearchPlan(st,context).some(row=>row.fields.includes('materials')));
});
test('a real reviewed trigger excerpt supplies the follow-up location without a manually supplied project label',()=>{
 const queries=Facts.queries({company:'Buyer',domain:'buyer.example'},essentials,{trigger});assert.ok(queries.some(row=>/Northport/.test(row.query)&&/schedule/.test(row.query)));
});
test('neutral comparison context is localized when every project and company label is unavailable',()=>{
 const T=require('../message-translations.js');for(const language of Object.keys(T.languages)){
  const row=fifth({...essentials,offer:'',language},{trigger:null,buyerCompany:'',subjectLanguage:language});assert.equal(row.ready,true,language);assert.ok(Array.from(row.subject).length<=60);if(language!=='en')assert.doesNotMatch(row.subject,/Your plans|compare now or later/);
 }
});
test('Profile search snippets retain their origin and cannot be promoted into verified message facts',()=>{
 const R=contract(),url='https://seller.example/projects/hospital',description='We delivered diagnostic equipment and completed installation at the hospital.',rows=C.normalizeSearchResults({data:[{url,description}]});
 assert.equal(rows[0].extracted,false);const merged=C.mergeSources([],rows),research=C.filterResearchSources(merged,'https://seller.example');assert.equal(research.primary.length,0);
 assert.equal(R.assess({essentials:{},context:{sellerWebsite:'https://seller.example',sellerEvidence:[{url,text:description,extracted:false}]}}).facts.find(row=>row.id==='reference').status,'missing');
});
test('an execution class in a URL cannot invent a second technical alternative',()=>{
 const context={sellerWebsite:'https://seller.example',sellerEvidence:[{url:'https://seller.example/quality',text:'We manufacture steel structures to EXC2. See https://seller.example/downloads/EXC3-guide.pdf for more.'}]};
 assert.equal(fifth({...essentials,offer:'steel'},context).subject,'Northport: compare now or later?');
});
