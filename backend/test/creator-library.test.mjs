import test from 'node:test';import assert from 'node:assert/strict';
import {storageDb} from './workspace-storage-fixture.mjs';
import {handleScriptLibraryRoute} from '../src/script-library-routes.js';
import {sha256} from '../src/security.js';
import channelScripts from '../../customer/channel-scripts.js';
const {fillScript}=channelScripts;
async function fixture(){
 const DB=storageDb(),env={DB,ADMIN_EMAIL:'owner@example.test',ADMIN_PASSWORD:'test-only-password'};
 DB.raw.exec("INSERT INTO users(id,email,display_name,role) VALUES('customer','customer@test.com','Customer','owner');INSERT INTO workspace_members(workspace_id,user_id,role) VALUES('storage-w1','customer','owner');");
 for(const [user,token] of [['storage-owner','admin'],['customer','customer'],['storage-owner','second-session']])DB.raw.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,'2099-01-01')").run(await sha256(token),user);
 let cookie='';return {DB,env,get cookie(){return cookie;},async call(path='',{method='GET',body,token='admin',unlock=cookie}={}){const r=await handleScriptLibraryRoute(new Request('https://app.test/api/script-library'+path+'?workspace_id=storage-w1',{method,headers:{Cookie:'leadintel_session='+token+'; '+unlock,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env);if(r.headers.has('Set-Cookie'))cookie=r.headers.get('Set-Cookie').split(';')[0];return {status:r.status,data:await r.json()};},async unlock(){return this.call('/creator/unlock',{method:'POST',body:{password:env.ADMIN_PASSWORD}});}};
}
const id='11111111-1111-4111-8111-111111111111',draft={channel:'phone',style:'professional',name:'Owner call',folder:'First calls',subject:'',original:'PRIVATE SOURCE ORIGINAL',body:'Hello {{firstName}}. {{sender}} here.',expectedRevision:0};
test('creator reads and writes require configured owner plus password, and legacy core writes cannot bypass it',async()=>{
 const f=await fixture();assert.equal((await f.call('/creator')).status,423);assert.equal((await f.call('/creator',{token:'customer'})).status,403);
 assert.equal((await f.call('/core/phone:professional',{method:'PUT',body:draft})).status,423);
 assert.equal((await f.call('/creator/unlock',{method:'POST',body:{password:'wrong'}})).status,401);assert.equal((await f.unlock()).status,200);
 assert.equal((await f.call('/creator')).status,200);assert.equal((await f.call('/creator',{token:'second-session'})).status,423);assert.equal((await f.call('/creator',{token:'customer'})).status,403);
 const forged=f.cookie.replace(/.$/,'x');assert.equal((await f.call('/creator',{unlock:forged})).status,423);
 await f.call('/creator/lock',{method:'POST'});assert.equal((await f.call('/creator')).status,423);
});
test('draft save, version history, CAS activation and customer generation use one registry',async()=>{
 const f=await fixture();await f.unlock();const before=(await f.call()).data.core.find(r=>r.id==='phone:professional');
 assert.equal((await f.call('/creator/'+id,{method:'PUT',body:draft})).status,200);
 assert.equal((await f.call()).data.core.find(r=>r.id===before.id).body,before.body,'draft cannot activate itself');
 assert.equal((await f.call('/creator/'+id,{method:'PUT',body:draft})).status,409);
 assert.equal((await f.call('/creator/'+id+'/activate',{method:'POST',body:{expectedRevision:1,expectedCoreRevision:99}})).status,409);
 assert.equal((await f.call('/creator/'+id+'/activate',{method:'POST',body:{expectedRevision:1,expectedCoreRevision:0}})).status,200);
 const active=(await f.call('',{token:'customer'})).data.core.find(r=>r.id===before.id);
 assert.equal(active.body,draft.body);assert.equal(active.original,undefined);assert.equal(active.history,undefined);assert.equal(active.builtin,false);
 assert.equal(fillScript(active,{firstName:'Alice',sender:'Bob'}).draft.message,'Hello Alice. Bob here.');
 assert.deepEqual(fillScript(active,{firstName:'Alice'}).missing,['sender']);
 assert.equal((await f.call('/creator/'+id,{method:'PUT',body:{...draft,body:'Version two {{firstName}}',expectedRevision:1}})).status,200);
 const saved=(await f.call('/creator')).data.scripts[0];assert.equal(saved.history[0].body,draft.body);assert.equal(saved.original,draft.original);
 assert.equal((await f.call()).data.core.find(r=>r.id===before.id).body,draft.body,'editing an active source does not change active snapshot');
 assert.equal((await f.call('/creator/'+id+'/activate',{method:'POST',body:{expectedRevision:1,expectedCoreRevision:1}})).status,409);
 assert.equal((await f.call('/creator/'+id+'/activate',{method:'POST',body:{expectedRevision:2,expectedCoreRevision:1}})).status,200);
 assert.equal((await f.call('/creator/'+id,{method:'DELETE',body:{expectedRevision:2}})).status,200);
 assert.equal((await f.call('/creator/'+id+'/activate',{method:'POST',body:{expectedRevision:3,expectedCoreRevision:2}})).status,404);
 assert.equal((await f.call()).data.core.find(r=>r.id===before.id).body,'Version two {{firstName}}');
});
test('unlock attempts are throttled and absent credentials fail closed',async()=>{
 const f=await fixture();for(let i=0;i<10;i++)assert.equal((await f.call('/creator/unlock',{method:'POST',body:{password:'wrong'}})).status,401);
 assert.equal((await f.unlock()).status,429);delete f.env.ADMIN_PASSWORD;assert.equal((await f.call('/creator/status')).data.passwordConfigured,false);assert.equal((await f.unlock()).status,503);
});
