const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const budget=require('../state-budget.js');

const backend=fs.readFileSync(path.join(__dirname,'..','..','backend','src','customer-state.js'),'utf8');

test('customer sync budget is exactly 500 KB',()=>{
  assert.equal(budget.MAX_SYNC_BYTES,500*1024);
  assert.match(backend,/MAX_CUSTOMER_STATE_BYTES\s*=\s*500\*1024/);
  assert.match(backend,/500 KB limit/);
});

test('large research evidence is compacted below the 500 KB sync ceiling without losing core profile data',()=>{
  const huge='x'.repeat(40000);
  const input={
    main:{website:'https://example.com/',targetMarkets:['Sweden'],answers:{priority_offers:'Steel structures'},profile:{companyName:'Example'},scrapedSources:Array.from({length:12},(_,i)=>({url:`https://example.com/${i}`,text:huge,title:`Source ${i}`})),documents:Array.from({length:5},(_,i)=>({name:`doc-${i}.pdf`,text:huge}))},
    discovery:{},outreach:{},delivery:{},meta:{}
  };
  const result=budget.prepareForSync(input);
  assert.ok(result.bytes<=500*1024);
  assert.equal(result.payload.main.website,'https://example.com/');
  assert.equal(result.payload.main.answers.priority_offers,'Steel structures');
  assert.equal(result.payload.main.profile.companyName,'Example');
  assert.ok(result.payload.main.scrapedSources.every(row=>row.text.length<=8000));
  assert.ok(result.payload.main.documents.every(row=>row.text.length<=12000));
});

test('maximum reference-customer import plus compact DNA stays below the sync ceiling',()=>{
  const rows=Array.from({length:200},(_,i)=>({id:`ref-${i}`,companyName:`Reference Company ${i}`,website:`https://ref-${i}.example`,domain:`ref-${i}.example`,country:i%2?'Germany':'Poland',productService:'Industrial automation',approximateValue:'€25,000–€100,000',reason:'Strong commercial fit',notes:'Priority reference customer',status:'ready',active:i<50}));
  const dimensions=Array.from({length:7},(_,i)=>({key:`dimension-${i}`,values:['industrial manufacturing','100-500 employees','B2B'],weight:1,confidence:'high',evidenceCount:30}));
  const input={main:{website:'https://seller.example/',targetMarkets:['Germany','Poland'],answers:{priority_offers:'Industrial automation'},profile:{companyName:'Seller'},referenceCustomers:{version:1,rows,activeIds:rows.slice(0,50).map(r=>r.id),activated:true,fingerprint:'rc-test',dna:{version:1,active:true,activeCount:50,analyzableCount:45,confidence:'high',dimensions}}},discovery:{},outreach:{},delivery:{},meta:{}};
  const result=budget.prepareForSync(input);
  assert.ok(result.bytes<=500*1024,`reference state exceeded sync budget: ${result.bytes}`);
  assert.equal(result.payload.main.referenceCustomers.rows.length,200);
  assert.equal(result.payload.main.referenceCustomers.activeIds.length,50);
  assert.equal(result.payload.main.referenceCustomers.dna.dimensions.length,7);
});

test('non-research workspace overflow is rejected rather than silently deleting business data',()=>{
  const input={main:{website:'https://example.com/'},discovery:{criticalNotes:'x'.repeat(520*1024)},outreach:{},delivery:{},meta:{}};
  assert.throws(()=>budget.prepareForSync(input),/500 KB sync limit/);
});
test('combined market reports and discovery evidence fit the budget without deleting records or provenance',()=>{
 const source=i=>({url:`https://evidence.example/${i}`,title:`Evidence ${i}`,date:'2026-10-01',text:'industrial evidence '.repeat(900),verification:{relevance:'high'}});
 const sources=Array.from({length:20},(_,i)=>source(i));
 const input={main:{profile:{companyName:'Seller'},answers:{priority_offers:'automation'},market:{researchResults:sources,researchReports:Array.from({length:10},(_,i)=>({id:`report-${i}`,sources}))},referenceCustomers:{rows:[{companyName:'Reference',website:'https://reference.example/'}]}},discovery:{rawResults:Array.from({length:50},(_,i)=>source(i)),candidates:Array.from({length:50},(_,i)=>({company:`Company ${i}`,domain:`company${i}.se`,evidence:sources.slice(0,5),matchedSignals:[{name:'Investment',evidence:[{url:source(i).url,quote:'Company announces a factory investment',date:'2026-10-01'}]}],people:[{name:'Buyer',linkedin_url:'https://linkedin.com/in/buyer'}]})),pipeline:[{company:'Saved company',notes:'Keep all business notes'}]},outreach:{scripts:[{text:'Keep this approved script'}]},delivery:{},meta:{persistence:{explicit_saved:true}}};
 const before=JSON.stringify(input),result=budget.prepareForSync(input);
 assert.ok(result.bytes<=budget.MAX_SYNC_BYTES);
 assert.equal(result.payload.main.market.researchReports.length,10);
 assert.equal(result.payload.main.market.researchResults.length,20);
 assert.equal(result.payload.discovery.candidates.length,50);
 assert.equal(result.payload.discovery.candidates[0].evidence.length,5);
 assert.equal(result.payload.discovery.candidates[0].evidence[0].url,sources[0].url);
 assert.equal(result.payload.discovery.candidates[0].matchedSignals[0].evidence[0].quote,'Company announces a factory investment');
 assert.equal(result.payload.discovery.candidates[0].people[0].name,'Buyer');
 assert.deepEqual(result.payload.discovery.pipeline,input.discovery.pipeline);
 assert.deepEqual(result.payload.outreach,input.outreach);
 assert.equal(JSON.stringify(input),before,'cloud compaction must not mutate local research');
 assert.equal(result.payload.main.market.researchReports[0].sources[0].evidenceTextTruncated,true);
});
test('expanded buyer traces sync losslessly while preserving ten buyers, URLs and decisions',()=>{
 const diagnostics=Array.from({length:166},(_,i)=>({index:i,source:i<10?'identity':'firecrawl',url:`https://linkedin.com/in/buyer-${i%20}`,title:'Anna Buyer – Procurement Director at Example Company with an expanded opportunity title '.repeat(4),parsedName:'Anna Buyer',parsedTitle:'Procurement Director',parsedCompany:'Example Company',parsing:'complete',companyVerification:'complete',roleMatching:'complete',accepted:i%3===0,rejectionReason:i%3===0?'':'Duplicate person or source identity'}));
 diagnostics[0].customEvidence={confirmed:true};diagnostics[1].nullable=null;
 const company={domain:'example.com',people:Array.from({length:10},(_,i)=>({id:`buyer-${i}`,name:'Anna Buyer',emailResearch:{status:'complete'},flowSelected:i===0})),buyerDiscovery:{resultDiagnostics:diagnostics,pool:[],researchIncomplete:true}};
 const input={main:{profile:{companyName:'Seller'},answers:{importantNotes:'x'.repeat(240*1024)}},discovery:{candidates:[company],selectedProspects:[company],pipeline:[company]},meta:{discovery:{scriptBuyer:{personId:'buyer-0',contactId:'verified-contact'}}}};
 const before=JSON.stringify(input);assert.ok(budget.bytes(input)>budget.MAX_SYNC_BYTES);
 const result=budget.prepareForSync(input);assert.ok(result.bytes<=budget.MAX_SYNC_BYTES);
 const restored=budget.restoreFromSync(JSON.parse(JSON.stringify(result.payload)));
 assert.deepEqual(restored,input);assert.equal(JSON.stringify(input),before);
 assert.equal(restored.discovery.selectedProspects[0].people.length,10);assert.equal(restored.meta.discovery.scriptBuyer.contactId,'verified-contact');
});
test('legacy trace arrays remain unchanged and malformed packed traces fail without deleting data',()=>{
 const legacy={discovery:{buyerDiscovery:{resultDiagnostics:[{url:'https://example.com',accepted:true}]}}};
 assert.deepEqual(budget.restoreFromSync(legacy),legacy);
 assert.throws(()=>budget.restoreFromSync({resultDiagnostics:{format:'leadintel-buyer-trace-v1',columns:['url'],values:['https://example.com'],rows:[[5]]}}),/Invalid stored buyer research trace/);
});
test('server hydration restores packed buyer decisions before writing local application state',()=>{
 const vm=require('node:vm'),source=fs.readFileSync(path.join(__dirname,'../server-bridge.js'),'utf8');
 const rows=Array.from({length:30},(_,i)=>({index:i,url:'https://example.com/team',title:'Repeated sourced title '.repeat(30),accepted:i%2===0}));
 const payload=budget.prepareForSync({main:{importantNotes:'x'.repeat(450*1024)},discovery:{buyerDiscovery:{resultDiagnostics:rows}},meta:{discovery:{scriptBuyer:{personId:'buyer-9'}}}}).payload;
 assert.equal(payload.discovery.buyerDiscovery.resultDiagnostics.format,'leadintel-buyer-trace-v1');
 const storage=new Map(),context={root:{LeadIntelStateBudget:budget},suppress:false,KEYS:{main:'main',discovery:'discovery',outreach:'outreach',delivery:'delivery',meta:'meta'},localStorage:{setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)}};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('  function applyPayload('),source.indexOf('  async function fetchSession(')),context);context.applyPayload(payload);
 assert.deepEqual(JSON.parse(storage.get('discovery')).buyerDiscovery.resultDiagnostics,rows);
 assert.equal(JSON.parse(storage.get('meta')).scriptBuyer.personId,'buyer-9');
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 assert.ok(html.indexOf('<script defer src="state-budget.js?')<html.indexOf('<script defer src="server-bridge.js?'));
});
test('repeated buyer pools and contact evidence share one lossless sync copy',()=>{
 const people=Array.from({length:30},(_,i)=>({id:'buyer-'+i,name:'Anna Buyer '+i,buyerQualification:{total:80,breakdown:{role:{points:35,max:35,basis:'Matches role'},source:{points:6,max:10,basis:'https://example.com/'+i}}},hunterChecks:Array.from({length:10},(_,j)=>({email:'anna'+i+j+'@example.com',status:'undeliverable',checkedAt:'2026-10-04T11:00:00.000Z'}))}));
 const company={domain:'example.com',people:people.slice(0,10),buyerDiscovery:{pool:people,resultDiagnostics:[]},publicResearch:{sourceEvidence:people}};
 const input={main:{notes:'x'.repeat(370*1024)},discovery:{candidates:[company],selectedProspects:[company],pipeline:[company]},meta:{},outreach:{},delivery:{}};
 assert.ok(budget.bytes(input)>budget.MAX_SYNC_BYTES);const result=budget.prepareForSync(input);assert.ok(result.bytes<=budget.MAX_SYNC_BYTES);assert.deepEqual(budget.restoreFromSync(JSON.parse(JSON.stringify(result.payload))),input);
});
test('nested company views and unique contact ledgers sync losslessly across repeated save boundaries',()=>{
 const people=Array.from({length:40},(_,i)=>({id:'buyer-'+i,name:'Buyer '+i,role:i%2?'Operations Director':'Procurement Director',contactResearch:{status:'complete',channels:{gmail:{status:'complete'},companyEmail:{status:'complete'}},checks:Array.from({length:24},(_,j)=>({email:`buyer${i}.${j}@example.com`,status:'unconfirmed',verificationEvidence:{provider:'Public source',reason:'Name and format filters passed; ownership remains unconfirmed',sourceUrl:`https://example.com/team/${i}`,checkedAt:'2026-10-05T09:52:24.804Z'}}))},qualification:{role:{points:25,basis:'Current role documented on the official company website; purchasing authority unconfirmed'},source:{points:10,basis:'Current role documented on the official company website; purchasing authority unconfirmed'}}}));
 const company={domain:'example.com',people:people.slice(0,10),buyerDiscovery:{pool:people},publicResearch:{people}};
 const input={main:{notes:'x'.repeat(300*1024)},discovery:{candidates:[{...company,view:'candidate'}],selectedProspects:[{...company,view:'selected'}],pipeline:[{...company,view:'saved',notes:'Preserve business history'}],literal:{leadintelResearchRef:0},array:[0,1,2]},outreach:{approvedDraft:'Preserve approved draft'},delivery:{history:[{status:'sent',messageId:'saved-message'}]},meta:{discovery:{scriptBuyer:{personId:'buyer-3'}}}};
 const before=JSON.stringify(input);assert.ok(budget.bytes(input)>budget.MAX_SYNC_BYTES);
 const first=budget.prepareForSync(input);assert.equal(first.payload.discovery.format,'leadintel-discovery-refs-v2');assert.ok(first.bytes<=budget.MAX_SYNC_BYTES);
 const second=budget.prepareForSync(first.payload);assert.deepEqual(second.payload,first.payload,'the fetch boundary must not nest wire formats');
 assert.deepEqual(budget.restoreFromSync(JSON.parse(JSON.stringify(second.payload))),input);assert.equal(JSON.stringify(input),before);
});
test('nested research decoding rejects cycles, invalid keys and invalid reference indices and reads legacy references',()=>{
 const packed=value=>({discovery:{format:'leadintel-discovery-refs-v2',keys:['name'],values:[],value}});
 assert.throws(()=>budget.restoreFromSync(packed([0,2])),/Invalid stored discovery research references/);
 assert.throws(()=>budget.restoreFromSync(packed([1,5,'Buyer'])),/Invalid stored discovery research references/);
 assert.throws(()=>budget.restoreFromSync(packed([1,0,'Buyer',0,'Duplicate'])),/Invalid stored discovery research references/);
 assert.throws(()=>budget.restoreFromSync({discovery:{format:'leadintel-discovery-refs-v2',keys:[],values:[[0,0]],value:[0,0]}}),/Invalid stored discovery research references/);
 assert.deepEqual(budget.restoreFromSync({discovery:{format:'leadintel-discovery-refs-v1',values:[{name:'Legacy buyer'}],value:{people:[{leadintelResearchRef:0}]}}}),{discovery:{people:[{name:'Legacy buyer'}]}});
 const literal=JSON.parse('{"__proto__":{"retained":true},"constructor":"Business field"}');
 assert.deepEqual(budget.restoreFromSync({discovery:{format:'leadintel-discovery-refs-v2',keys:['__proto__','retained','constructor'],values:[],value:[1,0,[1,1,true],2,'Business field']}}).discovery,literal);
});
test('saved server snapshots restore wire-packed discovery before creating a merge base',()=>{
 const vm=require('node:vm'),source=fs.readFileSync(path.join(__dirname,'../workspace-persistence.js'),'utf8');
 const storage=new Map(),context={root:{LeadIntelStateBudget:budget,localStorage:{setItem:(k,v)=>storage.set(k,v)},LeadIntelServerBridge:{workspace:{id:'workspace-1'}}},isObject:value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value)),buildActivationRecord:()=>null,markExplicitlySaved:()=>true,sameWorkspaceData:()=>true,currentWorkspaceData:()=>({}),dirtySinceSave:false,SNAPSHOT_KEY:'snapshot'};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('  function snapshotFromServerPayload('),source.indexOf('  function jsonResponse(')),context);
 context.snapshotFromServerPayload({main:{website:'https://seller.example/'},discovery:{format:'leadintel-discovery-refs-v2',keys:['people','name'],values:[],value:[1,0,[2,[1,1,'Buyer']]]}},{version:5});
 assert.deepEqual(JSON.parse(JSON.parse(storage.get('snapshot')).data.leadintel_customer_v2_discovery),{people:[{name:'Buyer'}]});
});
