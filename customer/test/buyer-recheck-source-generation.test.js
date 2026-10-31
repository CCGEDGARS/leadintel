const {test}=require('node:test'),assert=require('node:assert/strict');
const D=require('../discovery-engine.js'),CRM=require('../crm-engine.js');
const url='https://example.com/team',phone='+371 2211 3344';
const fixture=()=>({company:'Example',domain:'example.com',buyerSearchMode:'user_selected_target',people:[{id:'anna',name:'Anna Andersson',title:'Head of Procurement',organization:'Example',publicNameUrl:url}]});
const page=(stamp=new Date().toISOString())=>({url,markdown:'Anna Andersson — Head of Procurement — Example. Phone: '+phone+' anna.andersson@example.com',sourceRead:true,extractedAt:stamp});

test('forced failed rereads preserve historical contacts without refreshing attribution or coverage',async()=>{
 const c=fixture(),old=new Date(Date.now()-40*86400000).toISOString(),row=page(old),rows=[row];
 c.people=D.matchPublicBuyerDetails(c.people,[row],c.domain,c.company);
 const person=c.people[0];person.publicPhoneEvidence.checkedAt=old;person.publicPhoneSourceCheck.checkedAt=old;person.publicEmailEvidence.checkedAt=old;
 const evidence=structuredClone(person.publicPhoneEvidence),check=structuredClone(person.publicPhoneSourceCheck),reads=[];
 const official=await D.runOfficialContactResearch(c,{force:true,rows,search:async()=>[],readPage:async value=>{reads.push(value);throw Error('Official source down');}});
 const report=await D.runMandatoryBuyerResearch(c,{force:true,rows,currentRows:official.freshRows,search:async()=>[],readPage:async value=>{reads.push(value);throw Error('Named source down');}});
 assert.ok(reads.includes(url),'force must actually reread the saved named source');
 assert.deepEqual(person.publicPhoneEvidence,evidence);assert.deepEqual(person.publicPhoneSourceCheck,check);assert.equal(person.publicPhone,phone);
 assert.equal(person.publicEmailEvidence.checkedAt,old);assert.equal(D.confirmedBuyerPhone(c,person),'');
 assert.equal(report.status,'partial');assert.equal(D.buyerResearchCoveragePassed(c),false);assert.equal(report.officialPageReads.length,0);
 assert.equal(rows[0],row,'historical source bodies remain available');
 const restored=D.normalizeDiscoveryState(JSON.parse(JSON.stringify({selectedProspects:[c]}))).selectedProspects[0];
 assert.deepEqual(restored.people[0].publicPhoneEvidence,evidence);
 assert.deepEqual(CRM.mapDiscoveryCandidateToCrm(restored).intelligence.research_snapshot.buyerResearch.buyers[0].publicPhoneEvidence,evidence);
});

test('official research exposes only current successful reads separately from retained seed bodies',async()=>{
 const c=fixture(),old=page(new Date(Date.now()-40*86400000).toISOString()),rows=[old];
 const result=await D.runOfficialContactResearch(c,{force:true,rows,search:async()=>[{url}],readPage:async value=>value===url?page():{markdown:'Example official website'}});
 assert.ok(result.freshRows.length);assert.ok(!result.freshRows.includes(old));assert.ok(result.freshRows.every(row=>row.sourceRead===true&&Date.parse(row.extractedAt)>=Date.now()-10000));
 assert.equal(result.rows[0],old);
 const failed=await D.runOfficialContactResearch(c,{force:true,rows,search:async()=>[],readPage:async()=>{throw Error('Source down');}});
 assert.deepEqual(failed.freshRows,[],'a failed generation exposes no successful current reads');
});

test('mandatory force reuses explicitly acquired current rows once without redundant reads',async()=>{
 const c=fixture(),row=page(),currentRows=[row],queries=[],reads=[];
 const report=await D.runMandatoryBuyerResearch(c,{force:true,rows:[page('2020-01-01T00:00:00Z')],currentRows,search:async query=>{queries.push(query);return [{url}];},readPage:async value=>{reads.push(value);throw Error('Must reuse current successful read');}});
 assert.deepEqual(reads,[]);assert.ok(queries.length>=9);assert.equal(report.status,'complete');assert.equal(D.confirmedBuyerPhone(c,c.people[0]),phone);
 assert.equal(report.officialPageReads[0].checkedAt,row.extractedAt,'coverage keeps the actual upstream read time');
});

test('failed saved-source read leaves successful empty query receipts but incomplete research',async()=>{
 const c=fixture(),currentRows=[{url:'https://example.com/',markdown:'Example official company website',sourceRead:true,extractedAt:new Date().toISOString()}];
 const report=await D.runMandatoryBuyerResearch(c,{force:true,currentRows,search:async()=>[],readPage:async()=>{throw Error('Named staff source blocked');}}),person=c.people[0];
 assert.ok(Object.values(person.contactResearch.checks).flatMap(row=>row.queryLog||[]).every(row=>row.status==='complete'&&row.resultCount===0));
 assert.equal(person.emailResearch.status,'partial');assert.equal(person.emailResearch.failed,1);assert.equal(report.status,'partial');assert.equal(report.checkedPeople,0);
 assert.ok(report.gaps.some(gap=>gap.includes(url)&&gap.includes('Named staff source blocked')));assert.equal(D.buyerResearchCoveragePassed(c),false);
});

test('successful forced reads still complete empty searches and publish current evidence for callers',async()=>{
 const c=fixture(),currentRows=[],reads=[];
 const report=await D.runMandatoryBuyerResearch(c,{force:true,currentRows,search:async()=>[],readPage:async value=>{reads.push(value);return {markdown:'Example official company staff information'};}});
 assert.deepEqual(reads,[url]);assert.equal(report.status,'complete');assert.equal(c.people[0].emailResearch.failed,0);
 assert.ok(currentRows.some(row=>row.url===url&&row.sourceRead===true&&row.extractedAt));assert.equal(D.buyerResearchCoveragePassed(c),true);
});

for(const field of ['description','markdown'])test('unread '+field+' cannot confirm a phone when every actual source read fails',async()=>{
 const c=fixture(),row={url,[field]:'Anna Andersson — Head of Procurement — Example. Phone: '+phone};
 const report=await D.runMandatoryBuyerResearch(c,{force:true,currentRows:[],search:async()=>[row],readPage:async()=>{throw Error('Source blocked');}});
 assert.equal(report.status,'partial');assert.equal(report.officialPages,0);assert.equal(D.confirmedBuyerPhone(c,c.people[0]),'');
 assert.equal(c.people[0].publicPhone||'','');assert.equal(c.people[0].publicPhoneEvidence||null,null);
});

test('an unread conflicting phone snippet preserves the previously read phone and attribution date',()=>{
 const c=fixture(),row=page(new Date(Date.now()-86400000).toISOString());
 const person=D.matchPublicBuyerDetails(c.people,[row],c.domain,c.company)[0],evidence=structuredClone(person.publicPhoneEvidence),check=structuredClone(person.publicPhoneSourceCheck);
 const matched=D.matchPublicBuyerDetails([person],[{url:'https://example.com/contact',markdown:'Anna Andersson — Head of Procurement — Example. Phone: +371 9999 8888'}],c.domain,c.company)[0];
 assert.equal(matched.publicPhone,phone);assert.deepEqual(matched.publicPhoneEvidence,evidence);assert.deepEqual(matched.publicPhoneSourceCheck,check);assert.equal(D.confirmedBuyerPhone(c,matched),phone);
});

test('unread same-source bodies cannot erase retained phone evidence under older source-check versions',()=>{
 for(const version of [undefined,1,2]){
  const c=fixture(),row=page(),person=D.matchPublicBuyerDetails(c.people,[row],c.domain,c.company)[0];
  if(version===undefined)delete person.publicPhoneSourceCheck;else person.publicPhoneSourceCheck.version=version;
  const evidence=structuredClone(person.publicPhoneEvidence),check=structuredClone(person.publicPhoneSourceCheck);
  const matched=D.matchPublicBuyerDetails([person],[{url,markdown:'Example official staff page unavailable; no named contact in this snippet.'}],c.domain,c.company)[0];
  assert.equal(matched.publicPhone,phone);assert.deepEqual(matched.publicPhoneEvidence,evidence);assert.deepEqual(matched.publicPhoneSourceCheck,check);
 }
});

test('unversioned legacy phone attribution stays unconfirmed even with a fabricated fresh read ledger',()=>{
 const now=Date.now(),checkedAt=new Date(now-86400000).toISOString(),c=fixture();
 c.people=D.matchPublicBuyerDetails(c.people,[page(checkedAt)],c.domain,c.company);const person=c.people[0];delete person.publicPhoneEvidence.sourceRead;
 const receipt={url,sourceRead:true,checkedAt};
 const confirmed=reads=>{c.publicResearch={accountability:{...D.createBuyerResearchAccountability(),officialPageReads:reads}};return D.confirmedBuyerPhone(c,person,{}, {now});};
 const before=structuredClone(person);
 assert.equal(confirmed([]),'');assert.equal(confirmed([receipt]),'','old refresh code could fabricate both timestamps from cached bodies');assert.deepEqual(person,before,'retain the number and historical evidence unchanged');
 for(const change of [{url:'https://example.com/other'},{url:'https://other.example/team'},{sourceRead:false},{checkedAt:new Date(now-31*86400000).toISOString()},{checkedAt:new Date(now+1000).toISOString()},{checkedAt:new Date(Date.parse(checkedAt)-1).toISOString()}])assert.equal(confirmed([{...receipt,...change}]),'',JSON.stringify(change));
 person.publicPhoneEvidence.sourceRead=false;assert.equal(confirmed([receipt]),'','an explicit unread flag never receives legacy fallback');
});

test('actual phone-read provenance and explicit unread flags survive workspace and CRM reload',()=>{
 for(const sourceRead of [true,false]){
  const c=fixture();c.people=D.matchPublicBuyerDetails(c.people,[page()],c.domain,c.company);
  if(sourceRead===false)c.people[0].publicPhoneEvidence.sourceRead=false;
  const saved=D.normalizeDiscoveryState(JSON.parse(JSON.stringify({selectedProspects:[c]}))).selectedProspects[0];
  assert.equal(saved.people[0].publicPhoneEvidence.sourceRead,sourceRead);
  const snapshot=CRM.mapDiscoveryCandidateToCrm(saved).intelligence.research_snapshot.buyerResearch;
  assert.equal(snapshot.buyers[0].publicPhoneEvidence.sourceRead,sourceRead);assert.equal(D.confirmedBuyerPhone(saved,saved.people[0]),sourceRead?phone:'');
 }
});

for(const [label,location] of [
 ['cross-domain page.url',{url:'https://other.example/team'}],
 ['cross-domain metadata.url',{metadata:{url:'https://other.example/team'}}],
 ['malformed page.url',{url:'not-a-source-url'}],
 ['malformed metadata.sourceURL',{metadata:{sourceURL:'javascript:untrusted()'}}],
 ['malformed metadata.url',{metadata:{url:'not-a-source-url'}}],
 ['conflicting metadata',{url,metadata:{sourceURL:'https://other.example/team'}}],
 ['unsafe explicit credentials',{url:'https://user:secret@example.com/team'}]
])test('mandatory reads reject '+label+' without claiming requested-source provenance',async()=>{
 const c=fixture(),currentRows=[],report=await D.runMandatoryBuyerResearch(c,{force:true,currentRows,search:async()=>[],readPage:async()=>({markdown:page().markdown,...location})});
 assert.equal(report.status,'partial');assert.equal(report.officialPages,0);assert.equal(currentRows.length,0);assert.equal(D.confirmedBuyerPhone(c,c.people[0]),'');
 assert.equal(c.people[0].publicPhoneEvidence||null,null);assert.ok(report.gaps.some(row=>/source.*(?:url|redirect|attribution)/i.test(row)));
});

for(const [label,location] of [
 ['page.url',{url:'https://example.com/contact-team',metadata:{sourceURL:url}}],
 ['metadata.sourceURL',{metadata:{sourceURL:'https://example.com/contact-team'}}],
 ['metadata.url',{metadata:{url:'https://example.com/contact-team'}}]
])test('mandatory reads retain the actual same-domain redirect from '+label,async()=>{
 const c=fixture(),currentRows=[],actual='https://example.com/contact-team';
 const report=await D.runMandatoryBuyerResearch(c,{force:true,currentRows,search:async()=>[],readPage:async()=>({markdown:page().markdown,...location})});
 assert.equal(report.status,'complete');assert.equal(c.people[0].publicPhoneUrl,actual);assert.equal(c.people[0].publicPhoneEvidence.url,actual);assert.equal(D.confirmedBuyerPhone(c,c.people[0]),phone);
 assert.deepEqual(currentRows.map(row=>row.url),[actual]);assert.deepEqual(report.officialPageReads.map(row=>row.url),[actual]);
 if(location.metadata)assert.deepEqual(currentRows[0].metadata,location.metadata,'retain the extractor metadata beside the canonical actual source URL');
});
