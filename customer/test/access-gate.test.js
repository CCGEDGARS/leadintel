'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..','..');
const read=(...parts)=>fs.readFileSync(path.join(root,...parts),'utf8');

test('the site root is the sign-in page: both providers, invitation notice, no legacy chooser',()=>{
  const html=read('index.html');
  assert.match(html,/href="\/api\/auth\/google\/start"/);
  assert.match(html,/href="\/api\/auth\/microsoft\/start"/);
  assert.match(html,/available by invitation/);
  assert.match(html,/invite-required/);
  assert.doesNotMatch(html,/LeadIntel\.html/);
  assert.doesNotMatch(html,/Open legacy V1/);
  assert.match(html,/fetch\('\/api\/session'/);
});

test('the workspace page loads the access gate before any deferred module and before account-cache',()=>{
  const html=read('customer','index.html');
  const gate=html.indexOf('access-gate.js');
  assert.ok(gate>0);
  assert.ok(gate<html.indexOf('account-cache.js'));
  assert.ok(gate<html.indexOf('<script defer'));
});

test('gate decision: only a definite 401 sends a visitor to sign-in; OAuth returns and outages stay',()=>{
  const calls=[];
  const win={fetch:()=>Promise.resolve({status:200}),location:{search:'',replace:url=>calls.push(url)}};
  const source=read('customer','access-gate.js');
  new Function('window',source)(win);
  const gate=win.LeadIntelAccessGate;
  assert.equal(gate.decide(401,''),'sign-in');
  assert.equal(gate.decide(200,''),'stay');
  assert.equal(gate.decide(503,''),'stay');
  assert.equal(gate.decide(0,''),'stay');
  assert.equal(gate.decide(401,'?auth=success&workspace_id=w1'),'stay');
  assert.equal(gate.signInUrl(''),'/');
  assert.equal(gate.signInUrl('signed-out'),'/?access=signed-out');
});

test('gate runtime: a 401 session answer redirects to the root sign-in page, a 200 does not',async()=>{
  const source=read('customer','access-gate.js');
  const run=async(status,search='')=>{const calls=[];const win={fetch:(url,options)=>{assert.equal(url,'/api/session');assert.equal(options.credentials,'include');return Promise.resolve({status});},location:{search,replace:url=>calls.push(url)}};new Function('window',source)(win);await new Promise(r=>setTimeout(r,0));return calls;};
  assert.deepEqual(await run(401),['/']);
  assert.deepEqual(await run(200),[]);
  assert.deepEqual(await run(401,'?auth=success'),[]);
});
