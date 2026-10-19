import test from 'node:test';
import assert from 'node:assert/strict';
import {contactReviewInput,parseContactReview,reviewContactEvidence} from '../src/contact-evidence-review.js';

test('all ten retained people receive contradiction review and retain all ten conflicts',async()=>{
 const people=Array.from({length:11},(_,i)=>({id:'p'+i,name:'Ada Buyer'+i,role:'Director'}));
 const body={company:'Example',people,evidence:people.map(p=>({url:'https://example.com/'+p.id,excerpt:p.name+' current employer and role evidence'}))};
 const input=contactReviewInput(body);assert.equal(input.people.length,10);
 const result=await reviewContactEvidence({body,apiKey:'fixture',model:'fixture',generate:async options=>{
  const sent=JSON.parse(options.prompt);assert.ok(sent.people.some(p=>p.id==='p9'));
  return {text:JSON.stringify({conflicts:people.map(p=>({person_id:p.id,reason:'Current role is contradicted by the supplied source'}))})};
 }});
 assert.equal(result.conflicts.length,10);assert.ok(result.conflicts.some(p=>p.person_id==='p7'));assert.ok(!result.conflicts.some(p=>p.person_id==='p10'));
});

test('contact review keeps the supplied named evidence after a long source preamble',()=>{
 const excerpt='Company navigation and project background. '.repeat(24)+'Tony Bogdanoff, production manager, tony.bogdanoff@lkab.com';
 const input=contactReviewInput({company:'LKAB',people:[{id:'tony',name:'Tony Bogdanoff',role:'Produktionschef'}],evidence:[{url:'https://lkab.com/jobs',excerpt}]});
 assert.ok(input.evidence[0].excerpt.includes('tony.bogdanoff@lkab.com'));
});

test('Gemini contact review stays within supplied people and evidence',async()=>{
  const body={company:'Södra',people:[{id:'jacob',name:'Jacob Jonstoij',role:'Team Leader'}],evidence:[{url:'https://se.linkedin.com/in/jacob-jonstoij',title:'Jacob Jonstoij',excerpt:'Team Leader at Södra'},{url:'javascript:bad',title:'bad'}]};
  const input=contactReviewInput(body);
  assert.equal(input.evidence.length,1);
  const reviewed=await reviewContactEvidence({body,apiKey:'fake-key',model:'gemini-test',generate:async options=>{
    assert.match(options.system,/no web access/);
    return {text:JSON.stringify({summary:'One profile reviewed',conflicts:[{person_id:'unknown',reason:'Invented'},{person_id:'jacob',reason:'Role date unclear'}]})};
  }});
  assert.equal(reviewed.web_search,false);
  assert.deepEqual(reviewed.conflicts,[{person_id:'jacob',reason:'Role date unclear'}]);
  assert.throws(()=>parseContactReview('not json',input),/invalid JSON/);
});
