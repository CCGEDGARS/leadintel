const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../discovery-engine.js'),CRM=require('../crm-engine.js');
test('canceling a later official-page read retains the completed source checkpoint and resumes its unread queue',async()=>{
 let candidate={company:'North Works',domain:'north.example',buyerSearchMode:'user_selected_target',people:[]};
 const controller=new AbortController(),root='https://north.example/',contact=root+'contact',later=root+'supplier';
 let waiting,release,finished;const blocked=new Promise(r=>{release=r;}),started=new Promise(r=>{waiting=r;}),completed=new Promise(r=>{finished=r;});
 const task=D.runOfficialContactResearch(candidate,{signal:controller.signal,search:async()=>[],onProgress:({label})=>{if(label.includes('2/'))finished();},readPage:async url=>{
  if(url===later){waiting();return blocked;}return {url,markdown:url===root?'# North Works\n[Contact]('+contact+')\n[Supplier]('+later+')':'# North Works contact\nPublished business contact: info@north.example'};
 }});
 await Promise.all([started,completed]);controller.abort();const result=await task;
 assert.ok(candidate.buyerDiscovery?.officialContactInventory,'completed sources are checkpointed before cancellation');
 const inventory=candidate.buyerDiscovery.officialContactInventory;
 assert.equal(result.inventory,inventory);assert.equal(result.canceled,true);
 assert.ok(inventory.channels.some(row=>row.value==='info@north.example'));assert.equal(inventory.research.status,'partial');
 assert.ok(inventory.research.completedUrls.includes(contact));assert.ok(inventory.research.pendingUrls.includes(later));
 const stopped=JSON.stringify(inventory);release({url:later,markdown:'# Supplier\nlate@north.example'});await new Promise(r=>setImmediate(r));assert.equal(JSON.stringify(candidate.buyerDiscovery.officialContactInventory),stopped,'late provider results cannot change the checkpoint');
 candidate=D.normalizeDiscoveryState({selectedProspects:[candidate]}).selectedProspects[0];assert.ok(CRM.mapDiscoveryCandidateToCrm(candidate).intelligence.research_snapshot.buyerResearch.discovery.officialContactInventory.channels.some(row=>row.value==='info@north.example'));
 const reads=[];await D.runOfficialContactResearch(candidate,{search:async()=>[],readPage:async url=>{reads.push(url);return {url,markdown:'# North Works supplier\nsuppliers@north.example'};}});
 assert.deepEqual(reads,[later]);assert.equal(candidate.buyerDiscovery.officialContactInventory.research.status,'complete');
});
test('context loss after a source checkpoint cannot append late search receipts or contacts',async()=>{
 const candidate={company:'North Works',domain:'north.example',people:[]};let current=true,release,started;
 const searches=new Promise(r=>{release=r;}),pending=new Promise(r=>{started=r;});
 const task=D.runOfficialContactResearch(candidate,{guard:()=>{if(!current)throw Error('Workspace changed');},search:async()=>{started();return searches;},readPage:async url=>({url,markdown:'# North Works\nPublished contact: info@north.example'})});
 await pending;assert.ok(candidate.buyerDiscovery?.officialContactInventory);const checkpoint=JSON.stringify(candidate.buyerDiscovery.officialContactInventory);
 current=false;release([{url:'https://north.example/late-contact'}]);assert.equal((await task).canceled,true);await new Promise(r=>setImmediate(r));
 assert.equal(JSON.stringify(candidate.buyerDiscovery.officialContactInventory),checkpoint);
});
