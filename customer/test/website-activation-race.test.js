const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const MAIN='leadintel_customer_v2_state',ACTIVATION='leadintel_customer_v2_website_activation_v1',ACCOUNT='leadintel_account_context_v1';
function runtime(){
 const storage=new Map([[MAIN,JSON.stringify({website:'https://old.example/',answers:{priority_offers:'Customer-confirmed offer'},documents:[{name:'original.pdf'}],market:{approved:true}})],[ACCOUNT,'account-a'],['leadintel_customer_v2_discovery','saved companies']]);
 const input={value:'https://new.example/'},button={},events=[],listeners=new Map();let finish;
 const root={URL,AbortController,setTimeout,clearTimeout,console,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},document:{readyState:'loading',addEventListener(){},getElementById:id=>id==='company-website'?input:id==='activate-website'?button:null,querySelector:()=>({}),querySelectorAll:()=>[]},addEventListener:(type,fn)=>{const handlers=listeners.get(type)||[];handlers.push(fn);listeners.set(type,handlers);},dispatchEvent:e=>{events.push(e.type);for(const handler of listeners.get(e.type)||[])handler(e);},CustomEvent:class{constructor(type){this.type=type;}},fetch:()=>new Promise(resolve=>{finish=()=>resolve({ok:true,json:async()=>({data:{markdown:'Readable evidence for the newly selected company'}})});})};
 vm.runInNewContext(fs.readFileSync(require.resolve('../website-activation.js'),'utf8'),root);
 return {root,storage,input,events,finish:()=>finish()};
}
for(const kind of ['website','account'])test(`activation rejects a late scrape after the ${kind} changes without clearing saved work`,async()=>{
 const r=runtime(),before=new Map(r.storage),pending=r.root.LeadIntelWebsiteActivation.activateWebsite();
 if(kind==='website')r.input.value='https://third.example/';else r.storage.set(ACCOUNT,'account-b');
 const expected=new Map(r.storage);r.finish();assert.equal(await pending,false);assert.deepEqual(r.storage,expected);assert.equal(r.storage.has(ACTIVATION),false);assert.equal(r.events.includes('leadintel:website-activated'),false);assert.equal(r.storage.get(MAIN),before.get(MAIN));
});
test('activation for a stable account and website still commits the new evidence',async()=>{
 const r=runtime(),pending=r.root.LeadIntelWebsiteActivation.activateWebsite();r.finish();assert.equal(await pending,true);assert.equal(JSON.parse(r.storage.get(MAIN)).website,'https://new.example/');assert.equal(r.events.includes('leadintel:website-activated'),true);assert.equal(r.storage.has('leadintel_customer_v2_discovery'),false);assert.deepEqual(JSON.parse(r.storage.get(MAIN)).answers,{});
});

test('same-company evidence refresh preserves profile, markets, references and all downstream records',async()=>{
 const r=runtime();r.input.value='https://www.old.example/';
 const saved={website:'https://old.example/',companyContextWebsite:'https://old.example/',step:5,approved:true,profile:{website:'https://old.example/',companyName:'Original company'},answers:{priority_offers:'Confirmed offer'},answerStatus:{priority_offers:'user'},documents:[{name:'original.pdf'}],additionalLinks:['https://old.example/services'],referenceCustomers:{selected:['customer-1']},referenceCustomerPortfolio:{items:[{id:'customer-1'}]},market:{strategyApproved:true,researchResults:[{url:'https://market.example/report'}]},scrapedSources:[{type:'link',url:'https://old.example/services',text:'Services evidence'},{type:'website',url:'https://old.example/',text:'Previous website evidence'}]};
 r.storage.set(MAIN,JSON.stringify(saved));
 const keys=['leadintel_customer_v2_discovery','leadintel_customer_v2_outreach','leadintel_customer_v2_delivery','leadintel_customer_v2_discovery_meta','leadintel_customer_v2_research_meta_v1'];for(const key of keys)r.storage.set(key,JSON.stringify({saved:key}));const before=new Map(r.storage);
 let destructiveEvents=0;r.root.addEventListener('leadintel:website-activated',()=>{destructiveEvents++;for(const key of keys)r.storage.delete(key);});
 const pending=r.root.LeadIntelWebsiteActivation.activateWebsite();r.finish();assert.equal(await pending,true);
 const next=JSON.parse(r.storage.get(MAIN));for(const key of ['profile','approved','answers','answerStatus','documents','additionalLinks','referenceCustomers','referenceCustomerPortfolio'])assert.deepEqual(next[key],saved[key],key);
 assert.equal(next.market.strategyApproved,true);assert.deepEqual(next.market.researchResults,saved.market.researchResults);assert.equal(next.market.researchContextStale,true);assert.equal(next.market.researchContextFingerprint,'stale:website-reactivated','a forced marker must outlive a matching live fingerprint');
 assert.deepEqual(next.scrapedSources[0],saved.scrapedSources[0]);assert.match(next.scrapedSources[1].text,/Readable evidence/);
 for(const key of keys)assert.equal(r.storage.get(key),before.get(key),key);
 assert.equal(destructiveEvents,0);assert.equal(r.events.includes('leadintel:website-activated'),false,'refresh must not trigger destructive downstream reset listeners');assert.equal(r.events.includes('leadintel:company-research-updated'),true);assert.equal(r.events.includes('leadintel:workspace-dirty'),true);
});
