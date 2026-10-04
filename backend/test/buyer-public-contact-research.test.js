import test from 'node:test';
import assert from 'node:assert/strict';
import {researchBuyerContacts} from '../src/approved-workflow-runner.js';
test('automatic buyer research searches full name, company email and Gmail without paid reveal',async()=>{
 const candidate={company:'Example',domain:'example.com',people:[{name:'Anna Andersson',title:'COO'}]},queries=[];
 await researchBuyerContacts(candidate,async query=>{queries.push(query);return [{url:'https://example.com/team',title:'Anna Andersson | COO | Example',markdown:'Anna Andersson COO Example anna.andersson@example.com'}];},async()=>{});
 assert.equal(queries.length,3);assert.ok(queries.some(query=>query.includes('@gmail.com')));assert.equal(candidate.people[0].emailResearch.status,'complete');assert.equal(candidate.people[0].patternFindings[0].email,'anna.andersson@example.com');assert.equal(candidate.people[0].patternFindings[0].status,'public_unverified');
});
test('automatic contact research records failures and never presents guesses as found',async()=>{
 const candidate={company:'Example',domain:'example.com',people:[{name:'Anna Andersson',title:'COO'},{name:'Anna',identityStatus:'pending'}]};
 await researchBuyerContacts(candidate,async()=>{throw new Error('timeout');},async()=>{});
 assert.equal(candidate.people[0].emailResearch.status,'unavailable');assert.equal(candidate.people[0].emailResearch.failed,3);assert.equal(candidate.people[0].patternFindings,undefined);assert.equal(candidate.people[1].emailResearch.status,'not_searched');
});
test('automatic research uses observed company formats and rejects generic or unattributed addresses',async()=>{
 const candidate={company:'Example',domain:'example.com',people:[{name:'Anna Andersson',title:'COO'},{name:'Bob Smith',publicEmail:'bsmith@example.com',publicEmailUrl:'https://example.com/team'}]},queries=[];
 await researchBuyerContacts(candidate,async query=>{queries.push(query);return [{url:'https://example.com/team',markdown:'Example contact info@example.com and anna.andersson@example.com. Other Person is the listed owner.'}];},async()=>{});
 assert.ok(queries.some(query=>query.includes('"aandersson@example.com"')));assert.equal(candidate.people[0].patternFindings,undefined);assert.equal(candidate.people[0].publicEmail,undefined);
});
