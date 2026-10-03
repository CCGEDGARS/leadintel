const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js'),L=require('../lookalike-discovery.js');
L.install(D);
const ref={active:true,dna:{active:true,referenceProfiles:[{rowId:'r',companyName:'Reference',dimensions:[{key:'industry',values:['equipment manufacturers']},{key:'productionModel',values:['machine assembly']}],sourceEvidence:[{field:'industry',url:'https://ref.example/about',quote:'We manufacture equipment for industrial customers.'},{field:'productionModel',url:'https://ref.example/products',quote:'We perform machine assembly for customers.'}]}]}};
const p={website:'seller.example',idealCustomer:'equipment manufacturers',priorityOffers:'welded frames',targetMarkets:'Sweden',referenceSimilarityModel:ref};
test('strict discovery modes never leak the other discovery route',()=>{
 for(const mode of ['signals','lookalike','balanced']){
 const queries=D.buildDiscoveryQueries({...p,discoveryPriority:mode},{signals:[{active:true,name:'Expansion',keywords:'expansion'}]},5);
 assert.equal(queries.length,5);
 if(mode==='signals')assert.ok(queries.every(q=>!q.lookalike));
 if(mode==='lookalike')assert.ok(queries.every(q=>q.lookalike));
 if(mode==='balanced')assert.equal(queries.filter(q=>q.lookalike).length,3);
 }
});
test('commercial assessment rejects invented quotes and unconfirmed offers',()=>{
 const c={company:'Machines',domain:'machines.se',evidence:[{url:'https://machines.se/about',text:'Machines assembles equipment in Sweden using welded frames supplied by specialist partners.'}]};
 const row={domain:c.domain,fit:95,purchase:'welded frames',reason:'Frames are used in equipment assembly.',buyerRole:'equipment manufacturer',evidence:[{url:c.evidence[0].url,quote:c.evidence[0].text}]};
 const parsed=D.parseBuyerFit(JSON.stringify({companies:[row]}),[c],p);assert.equal(parsed[0].buyerFit.fit,95);
 assert.equal(D.parseBuyerFit(JSON.stringify({companies:[{...row,evidence:[{url:c.evidence[0].url,quote:'Invented procurement requirement'}]}]}),[c],p)[0].buyerFit,undefined);
 assert.equal(D.parseBuyerFit(JSON.stringify({companies:[{...row,purchase:'legal services'}]}),[c],p)[0].buyerFit,undefined);
});
test('one deduplicated list sorts total score before route and breaks ties on fit',()=>{
 const rows=D.rankQualifiedCompanies([{domain:'a.se',qualification:{score:81,buyerFitPoints:70,signalPoints:11,eligible:true,route:'both'}},{domain:'b.se',qualification:{score:90,buyerFitPoints:60,signalPoints:30,eligible:true,route:'signal'}},{domain:'b.se',qualification:{score:80,buyerFitPoints:60,signalPoints:20,eligible:true}},{domain:'c.se',qualification:{score:90,buyerFitPoints:65,signalPoints:25,eligible:true}}]);
 assert.deepEqual(rows.map(c=>c.domain),['c.se','b.se','a.se']);
});
test('buyer fit expires after targeting changes and cannot survive an invalid replacement',()=>{
 const quote='Machines assembles equipment in Sweden using welded frames supplied by specialist partners.';
 const c={company:'Machines',domain:'machines.se',evidence:[{url:'https://machines.se/about',text:quote}]};
 const row={domain:c.domain,fit:95,purchase:'welded frames',reason:'Frames support equipment assembly.',buyerRole:'equipment manufacturer',evidence:[{url:c.evidence[0].url,quote}]};
 const assessed=D.parseBuyerFit(JSON.stringify({companies:[row]}),[c],p)[0];
 assert.ok(D.verifiedBuyerFit(assessed,p));
 for(const change of [{priorityOffers:'legal advice'},{idealCustomer:'law firms'},{targetMarkets:'Finland'},{exclusions:'equipment manufacturers'}])assert.equal(D.verifiedBuyerFit(assessed,{...p,...change}),null);
 assert.equal(D.parseBuyerFit(JSON.stringify({companies:[]}),[assessed],p)[0].buyerFit,undefined);
});
test('saved discovery retains commercial reasoning and score breakdown',()=>{
 const quote='Machines assembles equipment in Sweden using welded frames supplied by specialist partners.';
 const c={company:'Machines',domain:'machines.se',website:'https://machines.se/',market:'Sweden',evidence:[{url:'https://machines.se/about',text:quote}]};
 const row={domain:c.domain,fit:95,purchase:'welded frames',reason:'Frames support equipment assembly.',buyerRole:'equipment manufacturer',evidence:[{url:c.evidence[0].url,quote}]};
 const assessed=D.parseBuyerFit(JSON.stringify({companies:[row]}),[c],p)[0];
 const saved=D.normalizeDiscoveryState({qualityVersion:D.DISCOVERY_QUALITY_VERSION,candidates:[{...assessed,qualified:true,marketVerified:true,buyerVerified:true,matchedSignals:[{id:'expansion',evidence:[{url:'https://machines.se/about'}]}],qualification:{version:2,score:85,buyerFitPoints:67,signalPoints:18},score:{total:85,fit:67,signal:18}}]});
 const loaded=D.normalizeDiscoveryState(JSON.parse(JSON.stringify(saved)));
 assert.ok(D.verifiedBuyerFit(loaded.candidates[0],p));
 assert.equal(loaded.candidates[0].qualification.score,85);
 assert.equal(loaded.candidates[0].buyerFit.purchase,'welded frames');
});
test('search and display share targeting context including reference exclusions',()=>{
 const fs=require('node:fs'),vm=require('node:vm');const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
 const body=source.slice(source.indexOf('function companyQualificationProfile('),source.indexOf('function qualificationAssessment('));
 const context={canonicalDomain:D.canonicalDomain,window:{LeadIntelTargeting:{profileFields:()=>({idealCustomer:'equipment manufacturers',priorityOffers:'welded frames'})}}};vm.createContext(context);vm.runInContext(body,context);
 const main={website:'seller.example',profile:{targetMarkets:'Latvia',idealCustomer:'obsolete'},targetMarkets:['Sweden'],answers:{exclusions:'retailers'},referenceCustomers:{rows:[{website:'https://ref.example/'}]}};
 const profile=context.companyQualificationProfile(main);assert.equal(profile.targetMarkets,'Sweden');assert.equal(profile.exclusions,'retailers; ref.example');assert.equal(profile.idealCustomer,'equipment manufacturers');
 assert.ok(source.includes('...companyQualificationProfile(main)'));
});
