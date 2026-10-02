const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js');
const now=Date.now(),date=new Date(now).toISOString().slice(0,10),researchedAt=new Date(now).toISOString();
const referenceSimilarityModel={dna:{active:true,referenceProfiles:[{rowId:'reference',companyName:'Reference',dimensions:[{key:'products',values:['steel structures']},{key:'production',values:['modular components']},{key:'sector',values:['renewable energy']}]}]}};
for(const ref of referenceSimilarityModel.dna.referenceProfiles)ref.sourceEvidence=ref.dimensions.map(d=>({field:d.key,url:'https://reference.example/about',quote:'Reference manufactures '+d.values.join(' ')+' for customers.'}));
const profile={website:'seller.example',idealCustomer:'renewable energy manufacturers',priorityOffers:'steel structures; modular components',referenceSimilarityModel};
const market={signals:[{id:'factory',name:'Factory investment',keywords:'new factory; investment',weight:10,active:true},{id:'expansion',name:'Expansion',keywords:'capacity expansion',weight:9,active:true}]};
const evidence=[{verifiedAt:researchedAt,url:'https://nordic.se/products',title:'Nordic products',text:'Nordic manufactures steel structures and modular components for renewable energy applications in Sweden. Its factory supplies wind energy manufacturers.'},{url:'https://journal.example/nordic',title:'Nordic investment',text:'Nordic announces investment in a new factory in Sweden using steel structures and modular components. The company plans capacity expansion for renewable energy equipment.',date}];
const candidate={company:'Nordic',domain:'nordic.se',market:'Sweden',evidence};
const assess=(c=candidate,priority='balanced',minimumScore=80)=>D.assessAutomaticQualification(c,profile,market,{researchPriority:priority,minimumScore,maxEvidenceAgeDays:90,researchedAt},now);
test('strong verified lookalike can reach 90 without claiming buying intent',()=>{
 const c={...candidate,evidence:[evidence[0],{...evidence[1],date:'',text:'Nordic manufactures steel structures and modular components for renewable energy markets in Sweden, according to the industry association company profile.'}]};
 const result=assess(c,'lookalike',90);assert.equal(result.eligible,true);assert.equal(result.route,'lookalike');assert.ok(result.score>=90);assert.equal(result.opportunityScore,null);assert.equal(result.referenceMatch.matchedTraits.length,3);
 assert.equal(assess(c,'signals').eligible,false);
});
test('thresholds change selection while mandatory checks cannot be bypassed',()=>{
 const result=assess();assert.equal(result.eligible,true);assert.equal(result.route,'both');
 for(const minimum of [70,80,90]){
  const blocked=assess({...candidate,evidence:[evidence[0]]},'lookalike',minimum);assert.equal(blocked.eligible,false);assert.match(blocked.gaps.join(' '),/independent/);
  assert.equal(assess({...candidate,lifecycle_status:'suppressed'},'balanced',minimum).eligible,false);
 }
 const partialProfile={...profile,referenceSimilarityModel:{dna:{referenceProfiles:[{rowId:'r',dimensions:[{key:'industry',values:['steel structures']},{key:'productionModel',values:['modular components']},{key:'capabilities',values:['renewable energy']},{key:'businessModel',values:['hydraulic actuators']}]}]}}};
 partialProfile.referenceSimilarityModel.dna.referenceProfiles[0].sourceEvidence=partialProfile.referenceSimilarityModel.dna.referenceProfiles[0].dimensions.map(d=>({field:d.key,url:'https://reference.example/about',quote:'Reference supplies '+d.values[0]+' products.'}));
 const low=D.assessAutomaticQualification(candidate,partialProfile,market,{researchPriority:'lookalike',minimumScore:90,researchedAt},now);assert.ok(low.score<90);assert.equal(low.eligible,false);
 const accepted=D.assessAutomaticQualification(candidate,partialProfile,market,{researchPriority:'lookalike',minimumScore:70,researchedAt},now);assert.equal(accepted.eligible,true);
});
test('missing reference evidence, stale verification and generic text remain unqualified',()=>{
 const missing=D.assessAutomaticQualification(candidate,{...profile,referenceSimilarityModel:null},market,{researchPriority:'lookalike',minimumScore:70,researchedAt},now);assert.equal(missing.lookalikeScore,null);assert.equal(missing.eligible,false);
 const stale=D.assessAutomaticQualification(candidate,profile,market,{researchPriority:'balanced',minimumScore:70,researchedAt:new Date(now-100*86400000).toISOString()},now);assert.equal(stale.eligible,false);assert.match(stale.gaps.join(),/Refresh/);
 const generic=assess({...candidate,evidence:[{...evidence[0],text:'Currently relevant development and structure. Our business supports quality production.'}]},'lookalike',70);assert.equal(generic.eligible,false);assert.equal(generic.score,null);
});
test('qualification is seller-name invariant and works across industries',()=>{
 const p={website:'law-seller.example',companyName:'First',idealCustomer:'software exporters',priorityOffers:'licensing contracts',referenceSimilarityModel:{dna:{referenceProfiles:[{companyName:'Example',dimensions:[{key:'products',values:['cloud software']},{key:'productionModel',values:['subscription licensing']}]}]}}};
 p.referenceSimilarityModel.dna.referenceProfiles[0].sourceEvidence=p.referenceSimilarityModel.dna.referenceProfiles[0].dimensions.map(d=>({field:d.key,url:'https://reference.example/about',quote:'Reference develops '+d.values[0]+' for customers.'}));
 const c={company:'CloudCo',domain:'cloudco.se',market:'Sweden',evidence:[{verifiedAt:researchedAt,url:'https://cloudco.se/about',text:'CloudCo exports cloud software through subscription licensing contracts to enterprise customers in Sweden. The company develops hosted software services for exporters.'},{url:'https://technology.example/cloudco',text:'CloudCo is a software exporter in Sweden, offering subscription licensing contracts to enterprise customers.'}]};
 const rules={researchPriority:'lookalike',minimumScore:80,researchedAt};const a=D.assessAutomaticQualification(c,p,{},rules),b=D.assessAutomaticQualification(c,{...p,companyName:'Unrelated'}, {},rules);assert.deepEqual(a,b);assert.equal(a.eligible,true);
});

test('a new research run cannot make cached official evidence fresh',()=>{
 for(const verifiedAt of ['',new Date(now-100*86400000).toISOString()]){
  const result=assess({...candidate,evidence:[{...evidence[0],verifiedAt},evidence[1]]},'lookalike',70);
  assert.equal(result.eligible,false);assert.match(result.gaps.join(' '),/Refresh company verification/);
 }
});
