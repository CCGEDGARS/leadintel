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

test('a quality review cannot declare completion without reviewing every supplied identity',()=>{
 const input=contactReviewInput({company:'Example',people:[{id:'a',name:'Anna Buyer',role:'CEO'},{id:'b',name:'Bob Buyer',role:'COO'}],evidence:[{url:'https://example.com/team',excerpt:'Anna Buyer CEO. Bob Buyer COO.'}]});
 assert.notEqual(parseContactReview('{}',input).supervisor?.status,'complete');
 const partial=parseContactReview(JSON.stringify({reviewed_person_ids:['a','invented'],conflicts:[]}),input);assert.equal(partial.supervisor.status,'partial');assert.deepEqual(partial.supervisor.reviewedPersonIds,['a']);
 const complete=parseContactReview(JSON.stringify({reviewed_person_ids:['a','b'],conflicts:[]}),input);assert.equal(complete.supervisor.status,'complete');
});
test('supervisor follow-up findings must cite a supplied source and existing person',()=>{
 const input=contactReviewInput({company:'Example',people:[{id:'a',name:'Anna Buyer',role:'CEO'}],evidence:[{url:'https://example.com/team',excerpt:'Anna Buyer CEO'}]});
 const result=parseContactReview(JSON.stringify({reviewed_person_ids:['a'],findings:[{person_id:'a',reason:'Employer unclear',source_url:'https://example.com/team'},{person_id:'a',reason:'Invented evidence',source_url:'https://other.com/'},{person_id:'ghost',reason:'Invented person',source_url:'https://example.com/team'}]}),input);
 assert.equal(result.supervisor.findings.length,1);assert.equal(result.supervisor.findings[0].person_id,'a');
});

test('the workspace supervisor uses the configured active AI when Gemini is absent and reports the actual provider',async()=>{
 const {reviewWorkspaceBuyerEvidence}=await import('../src/ai-routes.js'),{importAesKey,encryptSecret}=await import('../src/oauth.js');
 const secret=btoa(String.fromCharCode(...new Uint8Array(32).fill(9))),encrypted=await encryptSecret('fixture-provider-key',await importAesKey(secret)),calls=[];
 const env={OAUTH_TOKEN_ENCRYPTION_KEY:secret,DB:{prepare(sql){return {bind(){return this;},async first(){return sql.includes('active=1')?{provider:'openai',encrypted_api_key:encrypted,model:'fixture-model'}:null;},async run(){return {};}};}}};
 const result=await reviewWorkspaceBuyerEvidence(env,'w',{company:'Example',people:[{id:'a',name:'Anna Buyer',role:'CEO'}],evidence:[{url:'https://example.com/team',excerpt:'Anna Buyer CEO'}]},{generate:async options=>{calls.push(options.provider);return {text:JSON.stringify({reviewed_person_ids:['a'],conflicts:[]})};}});
 assert.deepEqual(calls,['openai']);assert.equal(result.provider,'openai');assert.equal(result.supervisor.status,'complete');
});

test('failed selected Gemini review can fall back to configured OpenAI even when OpenAI is not active',async()=>{
 const {reviewWorkspaceBuyerEvidence}=await import('../src/ai-routes.js'),{importAesKey,encryptSecret}=await import('../src/oauth.js');
 const secret=btoa(String.fromCharCode(...new Uint8Array(32).fill(8))),encrypted=await encryptSecret('fixture-key',await importAesKey(secret)),calls=[];
 const env={OAUTH_TOKEN_ENCRYPTION_KEY:secret,DB:{prepare(sql){return {bind(){return this;},async first(){return {provider:sql.includes("provider='openai'")?'openai':'gemini',encrypted_api_key:encrypted,model:'fixture'};},async run(){return {};}};}}};
 const result=await reviewWorkspaceBuyerEvidence(env,'w',{company:'Example',people:[{id:'a',name:'Anna Buyer',role:'CEO'}],evidence:[{url:'https://example.com/team',excerpt:'Anna Buyer CEO'}]},{generate:async options=>{calls.push(options.provider);if(options.provider==='gemini')throw Error('Provider unavailable');return {text:JSON.stringify({reviewed_person_ids:['a'],conflicts:[]})};}});
 assert.deepEqual(calls,['gemini','openai']);assert.equal(result.provider,'openai');assert.equal(result.supervisor.status,'complete');
});

test('a primary reviewer ignoring cancellation cannot consume the fallback deadline',async()=>{
 const {reviewWorkspaceBuyerEvidence}=await import('../src/ai-routes.js'),{importAesKey,encryptSecret}=await import('../src/oauth.js');
 const secret=btoa(String.fromCharCode(...new Uint8Array(32).fill(6))),encrypted=await encryptSecret('fixture-key',await importAesKey(secret)),calls=[];
 const env={OAUTH_TOKEN_ENCRYPTION_KEY:secret,DB:{prepare(sql){return {bind(){return this;},async first(){return {provider:sql.includes("provider='openai'")?'openai':'gemini',encrypted_api_key:encrypted,model:'fixture'};},async run(){return {};}};}}};
 const result=await Promise.race([reviewWorkspaceBuyerEvidence(env,'w',{company:'Example',people:[{id:'a',name:'Anna Buyer',role:'CEO'}],evidence:[{url:'https://example.com/team',excerpt:'Anna Buyer CEO'}]},{signal:new AbortController().signal,maxDurationMs:60,generate:async options=>{calls.push(options.provider);if(options.provider==='gemini')return new Promise(()=>{});assert.equal(options.reasoningEffort,'low');return {text:JSON.stringify({reviewed_person_ids:['a'],conflicts:[]})};}}),new Promise(resolve=>setTimeout(()=>resolve({hung:true}),200))]);
 assert.equal(result.hung,undefined);assert.deepEqual(calls,['gemini','openai']);assert.equal(result.provider,'openai');
});

test('independent reviewer receives the company trigger, employer and exact profile with targeted-check receipts',async()=>{
 const body={company:'Stegra',people:[{id:'klas',name:'Klas Nilsson',role:'Procurement Director',employer:'Stegra',linkedin:'https://linkedin.com/in/klas-stegra',checks:{direct_email:{status:'complete'},buyer_agent:{status:'partial'}}}],evidence:[{url:'https://stegra.com/team',excerpt:'Klas Nilsson, Procurement Director at Stegra.'}],buyerAgent:{version:'buyer-agent-20261028-v1',context:{company:'Stegra',domain:'stegra.com',seller:'Steel supplier',trigger:{quote:'Our first plant is under construction in Boden.',url:'https://stegra.com/project'},facts:[],gaps:['Project responsibility not confirmed']}}};
 await reviewContactEvidence({body,generate:async options=>{
  const input=JSON.parse(options.prompt);assert.equal(input.people[0].employer,'Stegra');assert.equal(input.people[0].linkedin,'https://linkedin.com/in/klas-stegra');assert.equal(input.people[0].checks.buyer_agent,'partial');assert.equal(input.people[0].checks.direct_email,'complete');assert.match(input.buyerAgent.trigger.quote,/Boden/);assert.match(options.system,/place name is not an employer/);assert.match(options.system,/shared name is never enough/);assert.match(options.system,/no web access/);
  return {text:JSON.stringify({reviewed_person_ids:['klas'],conflicts:[],findings:[]})};
 }});
});
