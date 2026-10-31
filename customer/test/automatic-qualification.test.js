const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js');
const now=Date.now(),date=new Date(now).toISOString().slice(0,10),researchedAt=new Date(now).toISOString();
const referenceSimilarityModel={active:true,dna:{active:true,referenceProfiles:[{rowId:'r',companyName:'Reference',dimensions:[{key:'industry',values:['renewable energy']},{key:'productionModel',values:['equipment assembly']}],sourceEvidence:[{field:'industry',url:'https://ref.example/about',quote:'Reference assembles equipment for renewable energy customers.'},{field:'productionModel',url:'https://ref.example/about',quote:'Reference operates equipment assembly lines.'}]}]}};
const profile={website:'seller.example',idealCustomer:'renewable energy equipment manufacturers',priorityOffers:'welded frames; modular components',referenceSimilarityModel};
const market={signals:[{id:'factory',name:'Factory investment',keywords:'new factory; investment',weight:10,active:true}]};
const evidence=[{verifiedAt:researchedAt,url:'https://nordic.se/products',text:'Nordic operates equipment assembly for renewable energy machinery in Sweden. We use welded frames purchased from specialist partners for our machines.'},{verifiedAt:researchedAt,url:'https://nordic.se/news',text:'Nordic announces investment in a new factory in Sweden for equipment assembly with welded frames for renewable energy machinery.',date},{url:'https://journal.example/nordic',text:'Nordic announces investment in a new factory in Sweden for renewable energy equipment assembly.',date}];
const raw={company:'Nordic',domain:'nordic.se',market:'Sweden',evidence,matchedSignals:[{evidence:[{url:evidence[1].url},{url:evidence[2].url}]}]};
function withFit(c=raw,p=profile,fit=100){return D.parseBuyerFit(JSON.stringify({companies:[{domain:c.domain,fit,purchase:'welded frames',reason:'Equipment assembly uses purchased frames.',buyerRole:'equipment manufacturer',relevantSignalUrls:[evidence[1].url,evidence[2].url],evidence:[{url:c.evidence[0].url,quote:c.evidence[0].text}]}]}),[c],p)[0];}
const candidate=withFit();
const assess=(c=candidate,priority='balanced',minimumScore=80,p=profile)=>D.assessAutomaticQualification(c,p,market,{researchPriority:priority,minimumScore,maxEvidenceAgeDays:90,researchedAt},now);
test('purchasing-fit prompt offers only official source choices and stable confirmed offer identifiers',()=>{
 const prompt=D.buyerFitPrompt([raw],profile);
 const seller=JSON.parse(prompt.split('. Seller: ')[1].split('. Companies: ')[0]);
 const companies=JSON.parse(prompt.split('. Companies: ')[1]);
 assert.deepEqual(seller.offerOptions,[{offerId:'offer-0',offer:'welded frames'},{offerId:'offer-1',offer:'modular components'}]);
 assert.ok(companies[0].evidence.length);
 assert.ok(companies[0].evidence.every(e=>e.url.startsWith('https://nordic.se/')&&e.sourceId));
 assert.match(prompt,/first-party/i);
});
test('stable offer and source choices resolve to exact approved offers and quoted official evidence',()=>{
 const p={...profile,priorityOffers:'drawing development, metal manufacturing, installation and qualified workforce solutions.'};
 const [c]=D.parseBuyerFit(JSON.stringify({companies:[{domain:raw.domain,fit:90,offerId:'offer-2',reason:'Factory installation is a specific application.',buyerRole:'industrial operator',evidence:[{sourceId:'source-0',quote:evidence[0].text}]}]}),[raw],p);
 assert.equal(c.buyerFit?.purchase,'installation and qualified workforce solutions.');
 assert.equal(c.buyerFit?.evidence[0].url,evidence[0].url);
 assert.equal(D.verifiedBuyerFit(c,p)?.fit,90);
});
test('rejected purchasing-fit responses retain a specific reason instead of silently erasing the assessment',()=>{
 const response={domain:raw.domain,fit:90,purchase:'welded frames',reason:'Assembly application.',buyerRole:'manufacturer',evidence:[{url:evidence[2].url,quote:evidence[2].text}]};
 const [external]=D.parseBuyerFit(JSON.stringify({companies:[response]}),[raw],profile);
 assert.equal(external.buyerFit,undefined);
 assert.match(external.buyerFitIssue,/official.*quote|first-party/i);
 const [badOffer]=D.parseBuyerFit(JSON.stringify({companies:[{...response,offerId:'offer-99',evidence:[{sourceId:'source-0',quote:evidence[0].text}]}]}),[raw],profile);
 assert.equal(badOffer.buyerFit,undefined);assert.match(badOffer.buyerFitIssue,/confirmed offer/i);
 const restored=D.normalizeDiscoveryState({qualityVersion:D.DISCOVERY_QUALITY_VERSION,potentialMatches:[{...external,qualificationGaps:['Verify purchasing application']}]}).potentialMatches[0];
 assert.equal(restored.buyerFitIssue,external.buyerFitIssue);
});
test('an unverified assessment is reported as an incomplete check while valid companies in its batch survive',async()=>{
 const second={...raw,domain:'other.se',evidence:[{...evidence[0],url:'https://other.se/products'}]},failures=[];
 const results=await D.researchBuyerFit([raw,second],profile,async()=>JSON.stringify({companies:[
  {domain:raw.domain,fit:90,offerId:'offer-0',reason:'Assembly uses frames.',buyerRole:'manufacturer',evidence:[{sourceId:'source-0',quote:evidence[0].text}]},
  {domain:second.domain,fit:90,offerId:'offer-0',reason:'Assembly uses frames.',buyerRole:'manufacturer',evidence:[{sourceId:'source-99',quote:evidence[0].text}]}
 ]}),{onFailure:(error,batch)=>failures.push({code:error.code,domains:batch.map(c=>c.domain)})});
 assert.equal(results[0].buyerFit.fit,90);assert.equal(results[1].buyerFit,undefined);
 assert.deepEqual(failures,[{code:'BUYER_FIT_EVIDENCE_REJECTED',domains:['other.se']}]);
});
test('fit score normalization accepts numeric JSON text and rejects nonnumeric or out-of-range values',()=>{
 const response={domain:raw.domain,fit:'90',offerId:'offer-0',reason:'Assembly uses frames.',buyerRole:'manufacturer',evidence:[{sourceId:'source-0',quote:evidence[0].text}]};
 assert.equal(D.parseBuyerFit(JSON.stringify({companies:[response]}),[raw],profile)[0].buyerFit?.fit,90);
 for(const fit of ['',null,true,'90%',-1,101])assert.equal(D.parseBuyerFit(JSON.stringify({companies:[{...response,fit}]}),[raw],profile)[0].buyerFit,undefined);
});
test('a provider failure on retry clears an old semantic rejection instead of reporting it twice',async()=>{
 const failures=[];
 const [result]=await D.researchBuyerFit([{...raw,buyerFitIssue:'Old unverified quote'}],profile,async()=>{throw Object.assign(new Error('Provider unavailable'),{status:502});},{onFailure:error=>failures.push(error.status)});
 assert.deepEqual(failures,[502]);assert.equal(result.buyerFitIssue,undefined);
});
test('a malformed sibling row cannot discard a valid company assessment',async()=>{
 const second={...raw,company:'Other',domain:'other.se',evidence:[{...evidence[0],url:'https://other.se/products',text:evidence[0].text.replaceAll('Nordic','Other'),sourceRead:true}]},failures=[];
 const results=await D.researchBuyerFit([raw,second],profile,async()=>JSON.stringify({companies:[{domain:raw.domain,fit:90,offerId:'offer-0',reason:'Assembly uses frames.',buyerRole:'manufacturer',evidence:[{sourceId:'source-0',quote:evidence[0].text}]},null]}),{onFailure:(error,batch)=>failures.push(batch.map(c=>c.domain))});
 assert.equal(results[0].buyerFit?.fit,90);assert.equal(results[1].buyerFitIssueCode,'invalid_assessment');assert.deepEqual(failures,[['other.se']]);
});
test('70 fit without signals stays a monitored lookalike; signals complete qualification',()=>{
 const c={...candidate,evidence:[evidence[0],{...evidence[2],date:'',text:'Nordic operates equipment assembly for renewable energy machines in Sweden.'}]};
 const result=assess(c,'lookalike');assert.equal(result.buyerFitPoints,70);assert.equal(result.signalPoints,0);assert.equal(result.score,70);assert.equal(result.eligible,false);
 const complete=assess(candidate,'lookalike');assert.equal(complete.eligible,true);assert.ok(complete.score>=80);assert.ok(complete.signalPoints<=30);
});
test('mandatory buyer and evidence gates cannot be bypassed by any threshold',()=>{
 for(const minimum of [70,80,90]){
 assert.equal(assess({...candidate,buyerFit:undefined},'balanced',minimum).eligible,false);
 assert.equal(assess({...candidate,evidence:[evidence[0],evidence[1]]},'lookalike',minimum).eligible,false);
 assert.equal(assess({...candidate,lifecycle_status:'suppressed'},'balanced',minimum).eligible,false);
 assert.equal(assess(withFit(raw,profile,60),'signals',minimum).eligible,false);
 }
});
test('lookalike requires customer similarity; signals mode ignores references',()=>{
 const p={...profile,referenceSimilarityModel:null};assert.equal(assess(candidate,'lookalike',80,p).eligible,false);assert.equal(assess(candidate,'signals',80,p).eligible,true);
 assert.equal(assess(candidate,'signals').lookalikeScore,null);
});
test('unrelated events, stale sources and new-run timestamps cannot qualify',()=>{
 assert.equal(assess({...candidate,buyerFit:{...candidate.buyerFit,relevantSignalUrls:[]}}).signalPoints,0);
 for(const verifiedAt of ['',new Date(now-100*86400000).toISOString()])assert.equal(assess({...candidate,evidence:candidate.evidence.map(e=>({...e,verifiedAt}))}).eligible,false);
});
test('commercial assessment survives reload but changed seller offers invalidate it',()=>{
 const restored=D.normalizeDiscoveryState({candidates:[{...candidate,qualified:true,marketVerified:true,buyerVerified:true,score:{total:95}}],qualityVersion:D.DISCOVERY_QUALITY_VERSION}).candidates[0];
 assert.equal(assess(restored).eligible,true);assert.equal(assess(restored,'balanced',80,{...profile,priorityOffers:'legal services'}).eligible,false);
 assert.deepEqual(assess(candidate,'balanced',80,{...profile,companyName:'First'}),assess(candidate,'balanced',80,{...profile,companyName:'Second'}));
});

test('independent fit batches preserve successful evidence when another batch fails, across seller industries and names',async()=>{
 for(const offers of ['welded frames','financial reporting']){
  for(const companyName of ['Ercon','Unrelated Seller']){
   const p={...profile,companyName,priorityOffers:offers},companies=Array.from({length:12},(_,i)=>({...raw,domain:`buyer${i}.example`,evidence:[{url:`https://buyer${i}.example/products`,text:`We purchase ${offers} for our operations in Sweden.`,verifiedAt:researchedAt}]}));
   let active=0,peak=0;const failures=[],progress=[];
   const result=await D.researchBuyerFit(companies,p,async(_,batch)=>{
    active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,2));active--;
    if(batch[0].domain==='buyer4.example')throw Object.assign(new Error('Unavailable'),{status:503});
    return JSON.stringify({companies:batch.map(c=>({domain:c.domain,fit:90,purchase:offers,reason:'Supplied operating evidence identifies a purchasing application.',buyerRole:'operating buyer',evidence:[{url:c.evidence[0].url,quote:c.evidence[0].text}]}))});
   },{retryAttempts:0,onFailure:(error,batch)=>failures.push(...batch),onProgress:p=>progress.push(p.completed)});
   assert.equal(peak,2);assert.equal(result.length,12);assert.equal(failures.length,4);assert.equal(result.filter(c=>D.verifiedBuyerFit(c,p)).length,8);assert.deepEqual(progress,[1,2,3]);
   for(const c of result.slice(4,8))assert.equal(D.assessAutomaticQualification(c,p,market,{minimumScore:70}).eligible,false);
  }
 }
});

test('purchasing-fit recovery retries only rejected companies and preserves the successful sibling',async()=>{
 const second={...raw,domain:'other.se',evidence:[{url:'https://other.se/about',text:'Other assembles renewable energy machinery with purchased welded frames in Sweden.'}]};
 const batches=[],failures=[];
 const results=await D.researchBuyerFit([raw,second],profile,async(prompt,batch)=>{
  batches.push(batch.map(c=>c.domain));
  return JSON.stringify({companies:batch.map(c=>({domain:c.domain,fit:85,offerId:'offer-0',reason:'Frames are used in equipment assembly.',buyerRole:'equipment manufacturer',evidence:[{sourceId:'source-0',quote:batches.length===1&&c.domain==='other.se'?'Invented quote that must fail.':c.evidence[0].text}]}))});
 },{onFailure:(e,batch)=>failures.push(...batch)});
 assert.deepEqual(batches,[['nordic.se','other.se'],['other.se']]);assert.equal(failures.length,0);assert.equal(results.filter(c=>D.verifiedBuyerFit(c,profile)).length,2);
});
test('purchasing-fit recovery retries transient provider errors but never billing or authentication failures',async()=>{
 for(const status of [502,402,401]){
  let calls=0;const failures=[];
  const result=await D.researchBuyerFit([raw],profile,async()=>{calls++;if(calls===1)throw Object.assign(new Error('Provider failure'),{status});return JSON.stringify({companies:[{domain:raw.domain,fit:80,offerId:'offer-0',reason:'Assembly needs frames.',buyerRole:'manufacturer',evidence:[{sourceId:'source-0',quote:evidence[0].text}]}]});},{onFailure:e=>failures.push(e)});
  assert.equal(calls,status===502?2:1);assert.equal(Boolean(result[0].buyerFit),status===502);assert.equal(failures.length,status===502?0:1);
 }
});
test('stable quote identifiers resolve only to supplied official evidence',()=>{
 const prompt=D.buyerFitPrompt([raw],profile),company=JSON.parse(prompt.split('. Companies: ')[1])[0],source=company.evidence[0];
 assert.ok(source.quoteOptions?.length);
 const response={companies:[{domain:raw.domain,fit:85,offerId:'offer-0',reason:'Assembly needs frames.',buyerRole:'manufacturer',evidence:[{sourceId:source.sourceId,quoteId:source.quoteOptions[0].quoteId}]}]};
 const result=D.parseBuyerFit(JSON.stringify(response),[raw],profile)[0];assert.ok(D.verifiedBuyerFit(result,profile));assert.equal(result.buyerFit.evidence[0].quote,source.quoteOptions[0].quote);
 response.companies[0].evidence[0].quoteId='invented';assert.equal(D.parseBuyerFit(JSON.stringify(response),[raw],profile)[0].buyerFit,undefined);
});
test('an explicit evidence abstention is a retained review outcome rather than an invalid score or provider failure',async()=>{
 const failures=[];let calls=0;const [result]=await D.researchBuyerFit([raw],profile,async()=>{calls++;return JSON.stringify({companies:[{domain:raw.domain,fit:null,offerId:null,evidenceStatus:'insufficient',relationship:'unverified',reason:'Only a navigation page was supplied.',evidence:[]}]});},{onFailure:e=>failures.push(e)});
 assert.equal(calls,1);assert.equal(failures.length,0);assert.equal(result.buyerFit,undefined);assert.equal(result.buyerFitIssueCode,'insufficient_evidence');assert.match(result.buyerFitIssue,/navigation page/i);
 const saved=D.normalizeDiscoveryState({potentialMatches:[{...result,qualificationGaps:D.assessCompanyQualification(result,profile,market).gaps}]}).potentialMatches[0];assert.equal(saved.buyerFitIssueCode,'insufficient_evidence');assert.equal(D.assessCompanyQualification(saved,profile,market).eligible,false);
 assert.equal(require('../crm-engine.js').mapDiscoveryCandidateToCrm(saved).intelligence.research_snapshot.buyerFitIssueCode,'insufficient_evidence');
 assert.match(D.buyerFitPrompt([raw],profile),/fit:null/);
});
test('quote choices validate against the same readable official text supplied to the model',()=>{
 const c={...raw,evidence:[{url:'https://nordic.se/about',verifiedAt:researchedAt,text:'We manufacture **renewable energy machinery** and [purchase welded frames](https://nordic.se/frames) for equipment assembly in Sweden.'}]};
 const source=JSON.parse(D.buyerFitPrompt([c],profile).split('. Companies: ')[1])[0].evidence[0];
 const response={companies:[{domain:c.domain,fit:85,offerId:'offer-0',reason:'Equipment assembly uses frames.',buyerRole:'manufacturer',evidence:[{sourceId:source.sourceId,quoteId:source.quoteOptions[0].quoteId}]}]};
 const result=D.parseBuyerFit(JSON.stringify(response),[c],profile)[0];assert.equal(result.buyerFit?.fit,85);assert.ok(D.verifiedBuyerFit(result,profile));
 response.companies[0].evidence[0]={sourceId:source.sourceId,quote:'We purchase computer equipment for a new factory.'};assert.equal(D.parseBuyerFit(JSON.stringify(response),[c],profile)[0].buyerFit,undefined);
});
test('invalid assessment recovery gets its precise validation reason and preserves that reason on final failure',async()=>{
 const prompts=[],failures=[];await D.researchBuyerFit([raw],profile,async prompt=>{prompts.push(prompt);return JSON.stringify({companies:[{domain:raw.domain,fit:null,evidenceStatus:'sufficient',relationship:'buyer',offerId:'offer-0'}]});},{onFailure:e=>failures.push(e)});
 assert.equal(prompts.length,2);assert.match(prompts[1],/valid fit score/i);assert.match(failures[0].detail,/valid fit score/i);
});
