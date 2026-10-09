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
   },{onFailure:(error,batch)=>failures.push(...batch),onProgress:p=>progress.push(p.completed)});
   assert.equal(peak,2);assert.equal(result.length,12);assert.equal(failures.length,4);assert.equal(result.filter(c=>D.verifiedBuyerFit(c,p)).length,8);assert.deepEqual(progress,[1,2,3]);
   for(const c of result.slice(4,8))assert.equal(D.assessAutomaticQualification(c,p,market,{minimumScore:70}).eligible,false);
  }
 }
});
