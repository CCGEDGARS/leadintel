import test from 'node:test';
import assert from 'node:assert/strict';
import {researchBuyerContacts} from '../src/approved-workflow-runner.js';
test('automatic contact research reads the discovered source and retains the direct phone without a paid reveal',async()=>{
 const candidate={company:'Example',domain:'example.com',people:[{name:'Anna Andersson',title:'COO',organization:'Example'}]},reads=[];
 await researchBuyerContacts(candidate,async()=>[{url:'https://example.com/team',description:'Anna Andersson — COO — Example anna.andersson@example.com'}],async()=>{},async url=>{reads.push(url);return {markdown:'Anna Andersson — COO — Example anna.andersson@example.com +46 70 111 2233',metadata:{sourceURL:url}};});
 assert.deepEqual(reads,['https://example.com/','https://example.com/team']);assert.equal(candidate.people[0].publicPhone,'+46 70 111 2233');assert.equal(candidate.people[0].publicPhoneEvidence.version,2);
});
test('an explicit page read supersedes incomplete search markdown for phone attribution',async()=>{
 const candidate={company:'Example',domain:'example.com',people:[{name:'Johan Menckel',title:'CEO and President',organization:'Example'}]};
 await researchBuyerContacts(candidate,async()=>[{url:'https://example.com/team',markdown:'Johan Menckel, CEO and President, +46 70 309 81 63.'}],async()=>{},async()=>({markdown:'Johan Menckel, CEO and President. Interviews: Mikko Viitala, Press Chief, +46 70 309 81 63.'}));
 assert.equal(candidate.people[0].publicPhone||'','');
});
test('an empty source extraction remains incomplete',async()=>{
 const candidate={company:'Example',domain:'example.com',people:[{name:'Anna Andersson',title:'COO',organization:'Example'}]};
 await researchBuyerContacts(candidate,async()=>[{url:'https://example.com/team',description:'Anna Andersson, COO at Example'}],async()=>{},async()=>({markdown:''}));
 assert.equal(candidate.people[0].emailResearch.status,'partial');assert.equal(candidate.people[0].emailResearch.failed,1);
});
test('automatic buyer research searches full name, company email and Gmail without paid reveal',async()=>{
 const candidate={company:'Example',domain:'example.com',people:[{name:'Anna Andersson',title:'COO'}]},queries=[];
 await researchBuyerContacts(candidate,async query=>{queries.push(query);return [{url:'https://example.com/team',title:'Anna Andersson | COO | Example',markdown:'Anna Andersson COO Example anna.andersson@example.com'}];},async()=>{});
 assert.equal(queries.length,9);assert.ok(queries.some(query=>query.includes('"anna.andersson@gmail.com"')));assert.equal(candidate.people[0].contactResearch.checks.gmail.status,'complete');assert.equal(candidate.people[0].emailResearch.status,'complete');assert.equal(candidate.people[0].patternFindings[0].email,'anna.andersson@example.com');assert.equal(candidate.people[0].patternFindings[0].status,'public_unverified');
});
test('automatic contact research records failures and never presents guesses as found',async()=>{
 const candidate={company:'Example',domain:'example.com',people:[{name:'Anna Andersson',title:'COO'},{name:'Anna',identityStatus:'pending'}]};
 await researchBuyerContacts(candidate,async()=>{throw new Error('timeout');},async()=>{});
 assert.equal(candidate.people[0].emailResearch.status,'unavailable');assert.equal(candidate.people[0].emailResearch.failed,11);assert.equal(candidate.people[0].patternFindings,undefined);assert.equal(candidate.people[1].emailResearch.status,'not_searched');
});
test('automatic research uses observed company formats and rejects generic or unattributed addresses',async()=>{
 const candidate={company:'Example',domain:'example.com',people:[{name:'Anna Andersson',title:'COO'},{name:'Bob Smith',publicEmail:'bsmith@example.com',publicEmailUrl:'https://example.com/team'}]},queries=[];
 await researchBuyerContacts(candidate,async query=>{queries.push(query);return [{url:'https://example.com/team',markdown:'Example contact info@example.com and anna.andersson@example.com. Other Person is the listed owner.'}];},async()=>{});
 assert.ok(queries.some(query=>query.includes('"aandersson@example.com"')));assert.equal(candidate.people[0].patternFindings,undefined);assert.equal(candidate.people[0].publicEmail,undefined);
});
