import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyAutomaticEmail} from '../src/automatic-email-verification.js';
const credential=async()=>({source:'customer',apiKey:'fixture-key'});
const verify=(data,status=200)=>verifyAutomaticEmail({},'w1','alex@example.com',{readPolicy:async()=>({enabled:true}),resolveCredential:credential,fetcher:async(url,opts)=>{assert.match(url,/alex%40example.com/);assert.equal(opts.headers['X-API-KEY'],'fixture-key');return new Response(JSON.stringify({data}),{status});}});
test('automatic verifier requires exact address, valid result and non-catch-all mailbox',async()=>{assert.equal((await verify({email:'alex@example.com',status:'valid'})).verified,true);for(const data of [{email:'wrong@example.com',status:'valid'},{email:'alex@example.com',status:'accept_all'},{email:'alex@example.com',status:'valid',accept_all:true},{email:'alex@example.com',status:'valid',block:true},{email:'alex@example.com',status:'invalid'},{email:'alex@example.com',status:'unknown'}])assert.equal((await verify(data)).verified,false);});
test('missing credential, quota, pending and provider errors hold email for review',async()=>{for(const status of [202,222,401,429,503])assert.equal((await verify({},status)).verified,false);assert.equal((await verifyAutomaticEmail({},'w1','alex@example.com',{resolveCredential:async()=>({source:'none'})})).verified,false);assert.equal((await verifyAutomaticEmail({},'w1','alex@example.com',{readPolicy:async()=>({enabled:true}),resolveCredential:credential,fetcher:async()=>{throw new Error('network');}})).verified,false);});
test('Hunter off accepts attributable Apollo verification without credentials or external calls',async()=>{
 let calls=0;const contact={name:'Alex Buyer',email_status:'verified',verification_provider:'Apollo',source:'apollo'};
 const env={DB:{prepare(){return {bind(workspace,email,domain){assert.equal(workspace,'w1');assert.equal(email,'alex@example.com');assert.equal(domain,'example.com');return {first:async()=>contact};}};}}};
 const result=await verifyAutomaticEmail(env,'w1','alex@example.com',{companyDomain:'example.com',readPolicy:async()=>({enabled:false}),resolveCredential:async()=>{calls++;throw new Error('not allowed');},fetcher:async()=>{calls++;throw new Error('not allowed');}});
 assert.equal(result.verified,true);assert.equal(result.provider,'Apollo');assert.equal(calls,0);
 for(const change of [{name:'Alex'},{email_status:'public_unverified'},{verification_provider:'public',source:'public'}]){
  const original={...contact};Object.assign(contact,change);assert.equal((await verifyAutomaticEmail(env,'w1','alex@example.com',{companyDomain:'example.com',readPolicy:async()=>({enabled:false})})).verified,false);Object.assign(contact,original);
 }
});
test('Hunter off cannot upgrade an email pattern or a Gmail address to verified',async()=>{
 const env={DB:{prepare(){return {bind(){return {first:async()=>({name:'Alex Buyer',email_status:'verified',source:'apollo'})};}};}}};
 assert.equal((await verifyAutomaticEmail(env,'w1','alex@gmail.com',{companyDomain:'example.com',readPolicy:async()=>({enabled:false})})).verified,false);
 assert.equal((await verifyAutomaticEmail(env,'w1','alex@example.com',{readPolicy:async()=>({enabled:false})})).verified,false);
});
test('enabled Hunter reuses a recent identity-bound check without spending credits',async()=>{
 let calls=0;const env={DB:{prepare(){return {bind(){return {first:async()=>({name:'Alex Buyer',verification_provider:'Hunter',verified_at:new Date().toISOString()})};}};}}};
 const result=await verifyAutomaticEmail(env,'w1','alex@example.com',{companyDomain:'example.com',readPolicy:async()=>({enabled:true}),resolveCredential:async()=>{calls++;throw new Error('unexpected');}});
 assert.equal(result.verified,true);assert.equal(result.cached,true);assert.equal(calls,0);
});
