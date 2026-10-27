import test from 'node:test';
import assert from 'node:assert/strict';
import {copilotResearchUrls,readCopilotPublicPage} from '../src/copilot-mentor.js';

test('direct website reading uses the actual bounded extractor and keeps source attribution',async()=>{
 const original=globalThis.fetch,calls=[];globalThis.fetch=async(url,options)=>{calls.push({url,options});return new Response('<html><title>Official team</title><main><h1>Management</h1><p>Alex Example — Purchasing Director. Contact alex@company.example.</p><script>not evidence</script><p>api_key=sk-proj-abcdefghijklmnopqrstuv</p></main></html>',{headers:{'Content-Type':'text/html'}});};
 try{const source=await readCopilotPublicPage('https://company.example/team');assert.equal(source.url,'https://company.example/team');assert.equal(source.title,'Official team');assert.equal(source.evidenceKind,'page_extract');assert.match(source.description,/Purchasing Director/);assert.match(source.description,/alex@company.example/);assert.doesNotMatch(source.description,/not evidence|sk-proj-/);assert.equal(calls[0].options.method,'GET');assert.equal(calls[0].options.redirect,'manual');assert.equal(calls[0].options.credentials,undefined);assert.ok(source.accessed_at);}
 finally{globalThis.fetch=original;}
});
test('website reader cannot fetch local URLs, credentials, signed URLs or restricted LinkedIn pages',async()=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('Must not fetch');};
 try{for(const url of ['http://127.0.0.1/','http://2130706433/','http://localhost/','http://private.internal/','https://user:password@company.example/','https://company.example/?access_token=secret','https://www.linkedin.com/in/private-profile','http://[::1]/']){assert.deepEqual(copilotResearchUrls(url),[]);await assert.rejects(readCopilotPublicPage(url),/public website URL/);}assert.equal(calls,0);}
 finally{globalThis.fetch=original;}
});
test('public-site redirects to private addresses fail before the redirected request',async()=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return new Response('',{status:302,headers:{Location:'http://169.254.169.254/latest/meta-data/'}});};
 try{await assert.rejects(readCopilotPublicPage('https://company.example/team'),/non-public URL/);assert.equal(calls,1);}
 finally{globalThis.fetch=original;}
});
test('one chat turn reads at most two distinct supplied URLs and does not invent more',()=>{
 assert.deepEqual(copilotResearchUrls('Read https://one.example/team, https://one.example/team and https://two.example/about then https://three.example/'),['https://one.example/team','https://two.example/about']);
});
