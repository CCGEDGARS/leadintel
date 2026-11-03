const test=require('node:test'),assert=require('node:assert/strict');require('../discovery-engine.js');const D=globalThis.LeadIntelDiscovery;
test('article and navigation headings cannot consume retained-person research slots',()=>{
 for(const name of ['New on site','Read more','Latest news','Meet our team','Contact us','Investor relations'])assert.equal(D.hasFullBuyerName(name),false,name);
 for(const name of ['Anna Berg','Emma Mäkitaavola','Jean-Claude Van Damme','Светлана Иванова','Aida Nur Sary'])assert.equal(D.hasFullBuyerName(name),true,name);
 const candidate={company:'Acme Labs',domain:'acme.example'},profile={decisionMakers:'Project Manager'},pool=['New on site','Anna Berg'].map((name,i)=>({id:String(i),name,title:'Project Manager',organization:candidate.company,publicNameUrl:'https://acme.example/projects',identityStatus:'confirmed'}));
 assert.deepEqual(D.retainBuyerIdentities(pool,profile,candidate).map(p=>p.name),['Anna Berg']);
});
