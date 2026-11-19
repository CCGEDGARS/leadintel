const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=require('../discovery-engine.js'),I=require('../strategy-integrity.js'),M=require('../market-engine.js');
const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
const section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
function fixture(t){
 const now=Date.now;t.after(()=>{Date.now=now;});Date.now=()=>Date.parse('2026-11-14T12:00:00Z');
 const profile={companyName:'Example Seller',website:'https://seller.example/',priorityOffers:'Industrial engineering',idealCustomer:'Industrial manufacturers',targetMarkets:'Denmark'};
 const signals=[{id:'expansion',name:'Factory expansion',keywords:'expansion',active:true,weight:8}],evidence={market:'Denmark',url:'https://manufacturer.example/news',title:'Danish factory expansion',text:'A manufacturer expands its factory in Denmark.',date:'2026-08-17',publishedDate:'2026-08-17',extractedAt:'2026-11-14T10:00:00Z',verification:{relevance:'strong',commercialFit:'strong'}};
 const main={approved:true,website:profile.website,targetMarkets:['Denmark'],profile,market:{strategyApproved:true,icps:[{id:'core',active:true,description:'Industrial manufacturers',targetMarkets:'Denmark'}],signals,researchResults:[evidence]}};
 main.market.opportunities=M.buildMarketOpportunities(profile,main.market.icps,signals,[evidence]);main.market.strategyApproval=I.approval(main);
 const storage=new Map([['main',JSON.stringify(main)]]),context={LeadIntelStrategyIntegrity:I,LeadIntelDiscovery:D,canonicalDomain:D.canonicalDomain,MAIN_STORAGE_KEY:'main',DISCOVERY_STORAGE_KEY:'companies',localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v))},mainState:()=>JSON.parse(storage.get('main')),saveDiscovery(){storage.set('companies',JSON.stringify(context.discovery));},showToast(){},restoreCheckedCompanyResearch(){},resetLocalDownstreamState(){assert.fail('Same seller must not reset its workspace');},qualificationAssessment:c=>c.qualification};
 context.window=context;vm.createContext(context);
 vm.runInContext(section('function recoverUnchangedCompanyResearch(','function loadDiscovery(')+section('function fingerprint(){','const DEFAULT_DISCOVERY_TARGET=')+section('function syncStrategyFingerprint(){','function restoreCheckedCompanyResearch(')+section('function companyStrategyCurrent(','function candidateIsActionable(')+section('function rankedCompanyResults(){','function companyResultScoreHtml(')+section('function rankedCheckedCompanies(){','function companySearchOutcome('),context);
 const original=context.fingerprint(),candidate={company:'Saved buyer',domain:'buyer.example',strategyFingerprint:original,researchedAt:'2026-11-14T10:00:00Z',evidence:[{url:'https://buyer.example/operations',verifiedAt:'2026-11-14T10:00:00Z',text:'Retained operating evidence'}],qualification:{eligible:true,score:84},people:[{id:'saved',name:'Retained Person',notes:'Manual work'}]};
 context.discovery={status:'complete',needsRefresh:false,pipeline:[],candidates:[candidate],selectedProspects:[JSON.parse(JSON.stringify(candidate))]};context.saveMeta({fingerprint:original,website:'seller.example',pipelineWebsite:'seller.example',lastCompanyRun:{fingerprint:original}});
 return {context,main,candidate,original,write:()=>storage.set('main',JSON.stringify(main)),reopen(){Date.now=()=>Date.parse('2026-11-17T12:00:00Z');main.market.opportunities=M.revalidateMarketOpportunities(profile,signals,main.market.opportunities);this.write();context.syncStrategyFingerprint();}};
}
test('automatic opportunity rescoring preserves approved Strategy and checked companies on reopen',t=>{
 const f=fixture(t),before=I.signature(f.main),saved=JSON.stringify(f.context.discovery.candidates),priority=f.main.market.opportunities[0].score.total;f.reopen();
 assert.notEqual(f.main.market.opportunities[0].score.total,priority,'Actual market revalidation ages the priority');assert.equal(I.signature(f.main),before);assert.equal(I.status(f.main).current,true);
 assert.equal(f.context.discovery.needsRefresh,false);assert.equal(f.context.rankedCheckedCompanies().length,1);assert.equal(JSON.stringify(f.context.discovery.candidates),saved,'Original evidence, dates and manual buyer work are retained');
});
test('a previously persisted false reset is repaired only against matching original company and run scopes',t=>{
 const f=fixture(t),saved=JSON.stringify(f.context.discovery.selectedProspects);f.reopen();f.context.discovery.needsRefresh=true;
 f.context.saveMeta({...f.context.loadMeta(),fingerprint:f.context.fingerprint()});f.context.saveDiscovery();
 f.context.discovery=JSON.parse(f.context.localStorage.getItem('companies'));f.context.syncStrategyFingerprint();
 assert.equal(f.context.discovery.needsRefresh,false);assert.equal(f.context.rankedCheckedCompanies().length,1);assert.equal(JSON.stringify(f.context.discovery.selectedProspects),saved);
});
for(const [label,change]of [['offer',s=>s.profile.priorityOffers='A different service'],['market',s=>s.targetMarkets=['Finland']],['signal',s=>s.market.signals[0].weight=2],['evidence',s=>s.market.researchResults[0].text='New underlying operating evidence']])test('actual '+label+' edits still invalidate saved companies even after Strategy reapproval',t=>{
 const f=fixture(t);change(f.main);f.main.market.strategyApproval=I.approval(f.main);f.write();f.context.syncStrategyFingerprint();assert.equal(I.status(f.main).current,true);assert.equal(f.context.discovery.needsRefresh,true);assert.equal(f.context.rankedCheckedCompanies().length,0);
});
for(const missing of ['company scope','run scope','current approval'])test('a persisted hold remains when recovery lacks '+missing,t=>{
 const f=fixture(t);f.reopen();f.context.discovery.needsRefresh=true;
 if(missing==='company scope')delete f.candidate.strategyFingerprint;
 if(missing==='run scope'){const meta=f.context.loadMeta();delete meta.lastCompanyRun.fingerprint;f.context.saveMeta(meta);}
 if(missing==='current approval'){f.main.market.strategyApproved=false;f.write();}
 f.context.syncStrategyFingerprint();assert.equal(f.context.discovery.needsRefresh,true);
});
test('legacy or malformed signatures cannot waive a changed opportunity score',t=>{
 const f=fixture(t);for(const signature of [undefined,'untrusted']){const a={...JSON.parse(f.original),strategySignature:signature},b={...a,opps:a.opps.map(row=>[row[0],row[1],row[2]+1])};assert.equal(f.context.sameStrategyFingerprint(JSON.stringify(a),JSON.stringify(b)),false);}
});
test('recovery preserves an explicit company recheck hold and never alters an active search',t=>{
 const f=fixture(t);f.reopen();f.candidate.needsRecheck=true;f.context.discovery.needsRefresh=true;
 assert.equal(f.context.recoverUnchangedCompanyResearch(f.context.discovery),true);assert.equal(f.candidate.needsRecheck,true);assert.equal(f.context.rankedCheckedCompanies().length,0);
 f.context.discovery.needsRefresh=true;f.context.discovery.status='running';assert.equal(f.context.recoverUnchangedCompanyResearch(f.context.discovery),false);assert.equal(f.context.discovery.needsRefresh,true);
});
test('null legacy metadata leaves the missing-scope hold and saved evidence intact',t=>{
 const f=fixture(t);f.context.discovery.needsRefresh=true;f.context.loadMeta=()=>null;const saved=JSON.stringify(f.candidate);
 assert.equal(f.context.recoverUnchangedCompanyResearch(f.context.discovery),false);assert.equal(f.context.discovery.needsRefresh,true);assert.equal(JSON.stringify(f.candidate),saved);
});
