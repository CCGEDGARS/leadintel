const test=require('node:test'),assert=require('node:assert/strict'),Sync=require('../workspace-sync.js');
const base=()=>({main:{website:'seller.example',answers:{offer:'Original',market:'Sweden'}},discovery:{people:[{id:'a',email:'a@buyer.example',source:'https://buyer.example/team'}]},outreach:{},delivery:{},meta:{discovery:{stage:4}}});
test('disjoint local navigation and remote buyer evidence merge without dropping either',()=>{
 const b=base(),l=base(),r=base();l.meta.discovery.stage=5;r.discovery.people.push({id:'b',source:'https://buyer.example/b'});
 const result=Sync.merge(b,l,r);assert.equal(result.safe,true);assert.equal(result.payload.meta.discovery.stage,5);assert.deepEqual(result.payload.discovery.people,r.discovery.people);assert.deepEqual(b,base());
});
test('independent edits in the same profile object merge by field',()=>{
 const b=base(),l=base(),r=base();l.main.answers.offer='Local offer';r.main.answers.market='Latvia';
 const result=Sync.merge(b,l,r);assert.equal(result.safe,true);assert.deepEqual(result.payload.main.answers,{offer:'Local offer',market:'Latvia'});
});
test('competing same-field edits and different buyer arrays require review',()=>{
 const b=base(),l=base(),r=base();l.main.answers.offer='Local';r.main.answers.offer='Remote';l.discovery.people=[];r.discovery.people.push({id:'b'});
 const result=Sync.merge(b,l,r);assert.equal(result.safe,false);assert.deepEqual(result.conflicts,['main.answers.offer','discovery.people']);
});
test('deletion remains deleted when only local changes it, but concurrent modification blocks',()=>{
 const b=base(),l=base(),r=base();delete l.main.answers.offer;r.main.answers.market='Latvia';
 assert.equal(Sync.merge(b,l,r).safe,true);assert.equal('offer' in Sync.merge(b,l,r).payload.main.answers,false);
 r.main.answers.offer='Changed remotely';assert.equal(Sync.merge(b,l,r).safe,false);
});
test('same edits, key reordering, and server persistence metadata do not create false conflicts',()=>{
 const b=base(),l=base(),r=base();l.main.answers.offer=r.main.answers.offer='Same';r.main.answers={market:'Sweden',offer:'Same'};r.meta.persistence={explicit_saved:true};
 assert.equal(Sync.merge(b,l,r).safe,true);assert.equal(Sync.equal(Sync.project(l),Sync.project(r)),true);
});
test('untrusted object keys cannot modify object prototypes',()=>{
 const b=base(),l=base(),r=base();l.main=JSON.parse('{"__proto__":{"polluted":true}}');
 assert.equal(Sync.merge(b,l,r).safe,true);assert.equal({}.polluted,undefined);
});

test('safe synchronization helper loads before the server bridge in the customer entry',()=>{
 const html=require('node:fs').readFileSync(require.resolve('../index.html'),'utf8');
 assert.ok(html.indexOf('workspace-sync.js?')>=0);assert.ok(html.indexOf('workspace-sync.js?')<html.indexOf('server-bridge.js?'));
});
