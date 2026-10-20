const test=require('node:test');
const assert=require('node:assert/strict');
const D=require('../discovery-engine.js');
const R=require('../first-party-research.js');
const profile={website:'seller.example',priorityOffers:'assembly services',idealCustomer:'equipment operators'};
const now=new Date().toISOString();
const operating='Nordic operates equipment assembly facilities in Sweden. Our production teams integrate purchased components and commission complete machinery for industrial customers.';
const cookies='We use cookies to improve your browsing experience. Accept all cookies. Manage cookie preferences. Your consent can be withdrawn at any time.';
function company(text=operating){return {company:'Nordic',domain:'nordic.se',market:'Sweden',evidence:[{url:'https://nordic.se/about',text,verifiedAt:now},{url:'https://journal.example/nordic',text:'Nordic operates industrial equipment assembly facilities in Sweden.',verifiedAt:now}]};}
function assessed(c,fit=85,extra={}){return D.parseBuyerFit(JSON.stringify({companies:[{domain:c.domain,fit,offerId:'offer-0',reason:'Assembly facilities provide a specific application for assembly services.',buyerRole:'equipment operator',evidence:[{url:c.evidence[0].url,quote:c.evidence[0].text}],...extra}]}),[c],profile)[0];}
test('a current official operating source supports manual review while automatic flow still requires independent corroboration',()=>{
 const one=company();one.evidence=one.evidence.slice(0,1);const candidate=assessed(one,85,{relationship:'buyer',evidenceStatus:'sufficient'});
 const manual=D.assessCompanyQualification(candidate,profile,{}, {researchedAt:now});
 assert.equal(manual.eligible,true);assert.equal(manual.score,85);assert.equal(manual.confidence,'Medium');assert.equal(manual.automaticEligible,false);
 const automatic=D.assessAutomaticCompanyQualification(candidate,profile,{}, {researchedAt:now});assert.equal(automatic.eligible,false);assert.ok(automatic.gaps.includes('Obtain two independent credible source families'));
 assert.equal(D.assessCompanyQualification({...candidate,evidence:[company().evidence[1]]},profile,{}, {researchedAt:now}).eligible,false,'independent commentary cannot replace official operating evidence');
});
test('cookie consent cannot verify purchasing fit even with an exact official quote and a high score',()=>{
 const c=assessed(company(cookies),95);
 assert.equal(D.verifiedBuyerFit(c,profile),null);
 assert.equal(D.assessCompanyQualification(c,profile,{}, {researchedAt:now}).eligible,false);
});
test('consent filtering preserves real food businesses that manufacture cookies',()=>{
 const text='Nordic manufactures cookies and biscuits in Sweden for supermarket chains. Our bakery production lines pack cookies for international retail customers.';
 assert.equal(D.companyOperatingEvidence(text),text);
});
test('company normalization and buyer prompt retain operating prose beyond a long navigation prefix',()=>{
 for(const operations of [operating,'Nordic runs a network of clinics in Sweden. Our clinical teams provide outpatient appointments and manage patient scheduling across twelve locations.']){
 const text=cookies+'\n'+Array.from({length:500},(_,i)=>`[Regional menu ${i}](/region/${i})`).join('\n')+'\n'+operations;
 const [row]=D.normalizeCompanySearchResults({results:[{url:'https://nordic.se/about',markdown:text}]},{kind:'verification',domain:'nordic.se',company:'Nordic',market:'Sweden'});
 const prompt=D.buyerFitPrompt([{...company(),evidence:[row]}],profile);
 assert.ok(prompt.includes(operations));
 assert.doesNotMatch(prompt,/Accept all cookies|Regional menu 499/);
 }
});
test('content selection preserves short dated buying events alongside operating prose',()=>{
 const announcement='Nordic announces a new plant in Sweden.';
 const [row]=D.normalizeCompanySearchResults({results:[{url:'https://nordic.se/news',date:now.slice(0,10),title:'Nordic update',markdown:announcement+'\n'+operating}]},{kind:'verification',domain:'nordic.se',company:'Nordic',market:'Sweden'});
 assert.ok(row.text.includes(announcement));
 assert.equal(D.matchedSignalsForEvidence([{name:'Expansion',keywords:'new plant; new factory',active:true,weight:9}],[row],'Sweden','Nordic').length,1);
});
test('a correctly scored zero remains outside the relevant company shortlist',()=>{
 const q=D.assessCompanyQualification(assessed(company(),0),profile,{}, {researchedAt:now});
 assert.equal(q.eligible,false);assert.equal(q.automaticEligible,false);
});
test('a plain-text navigation menu cannot establish operating evidence or qualify a company',()=>{
 for(const menu of ['Home About us Products and solutions Equipment Manufacturing capabilities Markets Sweden Sustainability Investors Careers News Contact Downloads','Home About us Products and solutions Equipment Manufacturing capabilities Markets Our Offers Sweden Sustainability Investors Careers News Contact Downloads']){
 assert.equal(D.companyOperatingEvidence(menu),'');
 assert.equal(D.assessCompanyQualification(assessed(company(menu),95),profile,{}, {researchedAt:now}).eligible,false);
 }
});
test('an evidenced non-buyer cannot qualify through a generous model score',()=>{
 for(const relationship of ['competitor','supplier','reseller','unrelated']){
 const q=D.assessCompanyQualification(assessed(company(),85,{relationship}),profile,{}, {researchedAt:now});
 assert.equal(q.eligible,false,relationship);
 }
});
test('website recovery follows supplied official pages when the homepage cannot be extracted',async()=>{
 const urls=[];
 const result=await R.collectWebsiteEvidence({website:'https://nordic.se/',purpose:'verification',maxPages:2,seedUrls:['https://nordic.se/about','https://foreign.example/about'],fetchImpl:async(_,init)=>{
 const {url}=JSON.parse(init.body);urls.push(url);
 if(url==='https://nordic.se/')return {ok:false,status:503,json:async()=>({})};
 return {ok:true,json:async()=>({data:{markdown:operating,metadata:{sourceURL:url}}})};
 }});
 assert.deepEqual(urls,['https://nordic.se/','https://nordic.se/about']);
 assert.equal(result.pages[0].url,'https://nordic.se/about');assert.equal(result.coverage.partial,true);
});
test('discovered-page recovery stops at the first authorization or billing failure',async()=>{
 for(const status of [401,402,403]){
 let calls=0;
 await assert.rejects(R.collectWebsiteEvidence({website:'https://nordic.se/',skipHome:true,seedUrls:['https://nordic.se/about','https://nordic.se/products'],fetchImpl:async()=>{calls++;return {ok:false,status,json:async()=>({})};}}),error=>error.status===status);
 assert.equal(calls,1);
 }
});
test('Companies puts results first, review next after them, and event context immediately before Buyers',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom');
 const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
 const dom=new JSDOM('<head></head><body><main class="content"></main></body>');
 const context={document:dom.window.document,$:id=>dom.window.document.getElementById(id),asset:name=>name,restoreDiscoveryTarget(){},renderDiscoveryEstimate(){}};
 vm.runInNewContext(source.slice(source.indexOf('function injectDiscoveryUI(){'),source.indexOf('function restoreDiscoveryTarget(){'))+'\ninjectDiscoveryUI();',context);
 const doc=dom.window.document,order=(a,b)=>Boolean(doc.getElementById(a).compareDocumentPosition(doc.getElementById(b))&4);
 assert.ok(order('company-candidates','company-review-batch'));
 assert.ok(order('company-review-batch','discovery-potential-matches'));
 assert.equal(doc.getElementById('company-search-context').nextElementSibling.className,'company-next-action');
 assert.equal(doc.querySelector('.company-search-advanced summary').textContent,'Search options');
 assert.equal(doc.querySelector('.company-shortlist-heading'),null);
});
