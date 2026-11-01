const test=require('node:test'),assert=require('node:assert/strict');const M=require('../event-campaigns.js');
const event={id:'e',name:'Industry Forum',startDate:'2099-10-10',endDate:'2099-10-12',location:'Berlin',stand:'B2',visitValue:'Discuss custom equipment.',audienceMode:'both',attendValue:'See new manufacturing equipment.',registrationUrl:'https://forum.test/register'};
test('unfinished events save as drafts, preserve planning settings on reload, but cannot activate',()=>{const s=M.save({}, {name:'Future fair',sourceChoice:'discover',targetCount:30,contactsPerCompany:2,researchDepth:'quick'});assert.equal(s.campaigns[0].targetCount,30);assert.equal(M.normalize(JSON.parse(JSON.stringify(s))).campaigns[0].researchDepth,'quick');assert.throws(()=>M.activate(s,s.campaigns[0].id));});
test('event participant and outside audiences produce different source query families',()=>{const inside=M.queries({...event,audienceMode:'participants'},{idealCustomer:'manufacturers'}),outside=M.queries({...event,audienceMode:'outside'},{idealCustomer:'manufacturers',targetMarkets:'Germany'});assert.ok(inside.every(q=>q.audience==='participants'));assert.ok(outside.every(q=>q.audience==='outside'));assert.ok(outside.some(q=>q.query.includes('Germany')));assert.equal(M.queries(event,{}).some(q=>q.audience==='outside'),true);});
test('public company evidence is edition-bound and never confirms a person',()=>{const evidence=[{url:'https://forum.test/2099/exhibitors',text:'Industry Forum 2099-10-10 exhibitors: Buyer Tools',verified:true,checkedAt:'2099-01-01'}];const a=M.deriveAttendance(event,{company:'Buyer Tools',id:'p1'},evidence);assert.equal(a.status,'company');assert.equal(M.deriveAttendance({...event,startDate:'2100-10-10'},{company:'Buyer Tools'},evidence).status,'unknown');assert.equal(M.deriveAttendance(event,{company:'Other'},evidence).status,'unknown');});
test('outside invitation gives reason to attend and registration, without claiming attendance',()=>{const d=M.draft(event,{sender:'Alex',company:'Seller'},{name:'Robin'},'professional','email',{purpose:'invite'});assert.match(d.message,/See new manufacturing equipment/);assert.match(d.message,/https:\/\/forum.test\/register/);assert.doesNotMatch(d.message,/you will be attending|your attendance is confirmed/i);});
test('same-year wrong editions and explicit non-participation never become attendance facts',()=>{for(const e of [{text:'Industry Forum 2099-03-01 exhibitors: Buyer Tools',eventStartDate:'2099-03-01'},{text:'Buyer Tools is not an exhibitor at Industry Forum 2099-10-10'}])assert.equal(M.deriveAttendance(event,{company:'Buyer Tools'},[{...e,url:'https://forum.test/list',verified:true,checkedAt:'2099-01-01'}]).status,'unknown');});
test('website analysis preserves historical evidence and resolves safe participant links',()=>{
 const s=M.websiteSuggestions('https://forum.test/2025/',{data:{metadata:{title:'Partner Forum'},markdown:'# Partner Forum\n2025-03-01\n[Exhibitors](exhibitors)\n[Speakers](javascript:bad)'}},'2026-11-01');
 assert.equal(s.name,'Partner Forum');assert.equal(s.startDate,undefined);assert.equal(s.sourceUrls,'https://forum.test/2025/exhibitors');assert.match(s.websiteEvidence,/2025-03-01/);
 const saved=M.normalize(JSON.parse(JSON.stringify(M.save({},s))));assert.equal(saved.campaigns[0].websiteEvidence,s.websiteEvidence);assert.equal(M.deriveAttendance(event,{company:'Partner Forum'},[]).status,'unknown');
});
test('website analysis leaves ambiguous dates for review and rejects unreadable sources',()=>{
 assert.throws(()=>M.websiteSuggestions('http://forum.test',{}),/HTTPS/);assert.throws(()=>M.websiteSuggestions('https://forum.test',{}),/No readable/);
 assert.equal(M.websiteSuggestions('https://forum.test',{markdown:'# Forum\n2099-01-01 and 2099-01-02'},'2026-11-01').startDate,undefined);
});
test('official event website reaches participant research; country research retains workspace industry',()=>{
 const q=M.queries({...event,website:'https://event.test',exhibitorUrl:'',country:'France'},{idealCustomer:'software consultancies'});
 assert.equal(q[0].sourceUrl,'https://event.test/');assert.match(q[0].query,/site:event.test/);
 const outside=q.find(x=>x.audience==='outside');assert.equal(outside.market,'France');assert.match(outside.query,/software consultancies/);assert.doesNotMatch(outside.query,/manufacturers/);
});

test('website suggestions extract explicitly labelled location and future date, never news dates',()=>{
 const a=M.websiteSuggestions('https://forum.test',{markdown:'# Forum\nCountry: Latvia\nCity: Riga\nVenue: Hall A\nEvent date: 2099-01-01'});assert.equal(a.country,'Latvia');assert.equal(a.location,'Riga');assert.equal(a.venue,'Hall A');assert.equal(a.startDate,'2099-01-01');
 assert.equal(M.websiteSuggestions('https://forum.test',{markdown:'# Forum\nNews published 2099-01-01'}).startDate,undefined);
});
