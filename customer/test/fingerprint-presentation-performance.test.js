const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8').replace(/\ninitDiscoveryWhenReady\(\);\s*$/,'');
function fixture(){
 let raw=JSON.stringify({website:'seller.example',profile:{companyName:'Seller'}}),statuses=0,signatures=0;const rules={researchPriority:'balanced',minimumScore:80,maxEvidenceAgeDays:90},event={market:'Sweden'};
 const c={console,URL,setTimeout:()=>1,clearTimeout(){},addEventListener(){},document:{getElementById:()=>null},localStorage:{getItem:()=>raw},LeadIntelDiscovery:{canonicalDomain:x=>x},LeadIntelStrategyIntegrity:{status:main=>{statuses++;return {current:true,signature:'status-'+main.profile.companyName}},signature:()=>{signatures++;return 'fallback'}},LeadIntelQualificationSettings:{get:()=>rules},LeadIntelEventCampaignUI:{searchContext:()=>event}};c.window=c;vm.createContext(c);vm.runInContext(source,c);
 return {c,rules,event,setMain:name=>{raw=JSON.stringify({website:'seller.example',profile:{companyName:name}})},counts:()=>({statuses,signatures})};
}
test('31 repeated presentation checks reuse one signature; actions and later frames recompute',()=>{
 const f=fixture();let first;f.c.withQualificationPresentation(()=>{for(let i=0;i<31;i++){const next=f.c.fingerprint();first??=next;assert.equal(next,first)}});assert.deepEqual(f.counts(),{statuses:1,signatures:0});f.c.fingerprint();f.c.fingerprint();assert.equal(f.counts().statuses,3);f.c.withQualificationPresentation(()=>f.c.fingerprint());assert.equal(f.counts().statuses,4);
});
test('saved content, rules and event edits invalidate the fingerprint during the same frame and between frames',()=>{
 const f=fixture();f.c.withQualificationPresentation(()=>{let value=f.c.fingerprint();for(const mutate of [()=>f.setMain('Changed seller'),()=>{f.rules.minimumScore=90},()=>{f.rules.maxEvidenceAgeDays=30},()=>{f.rules.researchPriority='signals'},()=>{f.event.market='Latvia'}]){mutate();const next=f.c.fingerprint();assert.notEqual(next,value);value=next}});assert.equal(f.counts().statuses,6);f.setMain('Another seller');f.c.withQualificationPresentation(()=>assert.match(f.c.fingerprint(),/Another seller/));assert.equal(f.counts().statuses,7);
});
for(const [owner,key] of [['LeadIntelStrategyIntegrity','status'],['LeadIntelStrategyIntegrity','signature'],['LeadIntelQualificationSettings','get'],['LeadIntelEventCampaignUI','searchContext'],['LeadIntelEventCampaigns','researchContext'],['LeadIntelEventCampaigns','active']])test(`replacing ${owner}.${key} invalidates a frame cache`,()=>{
 const f=fixture();f.c.LeadIntelEventCampaigns={active:()=>null,researchContext:()=>null};f.c.withQualificationPresentation(()=>{f.c.fingerprint();const original=f.c[owner][key];f.c[owner][key]=(...args)=>original(...args);f.c.fingerprint()});assert.equal(f.counts().statuses,2);
});
test('nested frames share only their synchronous outer frame and exceptions clear its cache',()=>{
 const f=fixture();assert.throws(()=>f.c.withQualificationPresentation(()=>{f.c.fingerprint();f.c.withQualificationPresentation(()=>f.c.fingerprint());throw Error('controlled')}));assert.equal(f.counts().statuses,1);f.c.withQualificationPresentation(()=>f.c.fingerprint());assert.equal(f.counts().statuses,2);
});
test('a presentation callback returning a promise cannot retain its cache after await',async()=>{
 const f=fixture();await f.c.withQualificationPresentation(async()=>{f.c.fingerprint();await Promise.resolve();f.c.fingerprint();f.c.fingerprint()});assert.equal(f.counts().statuses,3);
});
test('missing status signature preserves the existing explicit signature fallback',()=>{
 const f=fixture();f.c.LeadIntelStrategyIntegrity.status=()=>({current:false,signature:''});assert.match(f.c.fingerprint(),/fallback/);assert.equal(f.counts().signatures,1);
});
