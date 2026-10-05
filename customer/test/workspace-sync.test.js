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
test('competing same-field edits require review while unrelated buyer additions remain recoverable',()=>{
 const b=base(),l=base(),r=base();l.main.answers.offer='Local';r.main.answers.offer='Remote';l.discovery.people=[];r.discovery.people.push({id:'b'});
 const result=Sync.merge(b,l,r);assert.equal(result.safe,false);assert.deepEqual(result.conflicts,['main.answers.offer']);assert.deepEqual(result.payload.discovery.people,[{id:'b'}]);
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

test('independent buyer contact updates merge by stable identity without dropping either record',()=>{
 const b=base();b.discovery.people.push({id:'b',name:'Other Buyer'});
 const l=structuredClone(b),r=structuredClone(b);l.discovery.people[0].phone='+37112345678';r.discovery.people[1].email='other@buyer.example';
 const result=Sync.merge(b,l,r);assert.equal(result.safe,true);
 assert.equal(result.payload.discovery.people[0].phone,'+37112345678');assert.equal(result.payload.discovery.people[1].email,'other@buyer.example');
});
test('different cloud and browser evidence representations are compared against their own baselines',()=>{
 const b=base(),lb=base();b.discovery.rawResults=[{url:'https://buyer.example/news',text:'Short excerpt'}];lb.discovery.rawResults=[{url:'https://buyer.example/news',text:'Full original evidence body'}];
 const l=structuredClone(lb),r=structuredClone(b);l.meta.discovery.stage=5;r.discovery.rawResults.push({url:'https://buyer.example/new',text:'New evidence'});
 const result=Sync.merge(b,l,r,{localBase:lb});assert.equal(result.safe,true);assert.equal(result.payload.meta.discovery.stage,5);assert.equal(result.payload.discovery.rawResults.length,2);
});

test('deleting one buyer and researching a different buyer preserves the deletion and new evidence',()=>{
 const b=base(),l=base(),r=base();l.discovery.people=[];r.discovery.people.push({id:'b',email:'b@buyer.example'});
 const result=Sync.merge(b,l,r);assert.equal(result.safe,true);assert.deepEqual(result.payload.discovery.people,[{id:'b',email:'b@buyer.example'}]);
 r.discovery.people[0].email='changed@buyer.example';assert.equal(Sync.merge(b,l,r).safe,false,'delete versus edit of the same buyer requires review');
});
test('keyed buyer merging cannot combine an email with a source from another concurrent verification',()=>{
 const b=base();Object.assign(b.discovery.people[0],{publicEmail:'old@buyer.example',publicEmailUrl:'https://buyer.example/old'});
 const l=structuredClone(b),r=structuredClone(b);l.discovery.people[0].publicEmail='local@buyer.example';r.discovery.people[0].publicEmailUrl='https://buyer.example/remote';
 assert.equal(Sync.merge(b,l,r).safe,false);
});
test('ambiguous record identities remain blocked and simultaneous qualification timestamps do not block independent research',()=>{
 const b=base(),l=base(),r=base();b.discovery.people[0].buyerQualification={assessedAt:'2026-10-01'};
 l.discovery.people[0].buyerQualification={assessedAt:'2026-10-02'};l.discovery.people[0].phone='123';
 r.discovery.people[0].buyerQualification={assessedAt:'2026-10-03'};r.discovery.people[0].email='new@buyer.example';
 const result=Sync.merge(b,l,r);assert.equal(result.safe,true);assert.equal(result.payload.discovery.people[0].buyerQualification,undefined);
 l.discovery.people.push({...l.discovery.people[0]});assert.equal(Sync.merge(b,l,r).safe,false);
});
