import test from 'node:test';
import assert from 'node:assert/strict';
import {contactReviewInput,parseContactReview,reviewContactEvidence} from '../src/contact-evidence-review.js';

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
