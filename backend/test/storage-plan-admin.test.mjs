import test from 'node:test';
import assert from 'node:assert/strict';
import {handleAccessRoute} from '../src/access-invitations.js';
import {getStorageStatus} from '../src/workspace-storage.js';
import {sha256} from '../src/security.js';
import {storageDb} from './workspace-storage-fixture.mjs';

test('only admins can change enforced quotas and restore inheritance without changing usage',async()=>{
 const DB=storageDb(),env={DB,APP_ORIGIN:'https://app.test',PLATFORM_ADMIN_EMAILS:'owner@example.test'};
 DB.raw.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,'storage-owner',datetime('now','+1 day'))").run(await sha256('storage'));
 const api=(workspace='',body,origin=env.APP_ORIGIN)=>handleAccessRoute(new Request('https://app.test/api/access/storage-plans?workspace='+workspace,{
  method:body?'POST':'GET',headers:{Cookie:'leadintel_session=storage',Origin:origin,'Content-Type':'application/json'},body:body&&JSON.stringify(body)
 }),env,{});
 const initial=(await (await api()).json()).settings;
 const standard={...initial,action:'save',included_records_limit:120,monthly_amount_minor:1100};
 assert.equal((await api('',standard,'https://other.test')).status,403);
 env.PLATFORM_ADMIN_EMAILS='another@example.test';
 assert.equal((await api('',standard)).status,403);
 env.PLATFORM_ADMIN_EMAILS='owner@example.test';
 const workspace='storage-w1';
 const custom={...initial,action:'save',limits_revision:0,included_records_limit:220};
 assert.equal((await api(workspace,custom)).status,200);
 assert.equal((await api('',standard)).status,200);
 assert.equal((await api(workspace,custom)).status,409);
 assert.equal((await api('',standard)).status,409);
 assert.equal((await api('',{...standard,revision:1,plus_records_limit:1})).status,400);
 assert.equal((await getStorageStatus(env,'storage-w2')).records.limit_bytes,120);
 assert.equal((await getStorageStatus(env,workspace)).records.limit_bytes,220);
 DB.raw.exec("INSERT INTO workspaces(id,name,market,owner_user_id) VALUES('new','New','LV','storage-owner')");
 assert.equal((await getStorageStatus(env,'new')).records.limit_bytes,120);
 const insert=DB.raw.prepare("INSERT INTO content_materials(id,workspace_id,title,category,body,created_by) VALUES(?,'storage-w1','Example','draft',?,'storage-owner')");
 insert.run('kept','x'.repeat(150));
 assert.equal((await api(workspace,{action:'reset',revision:1,limits_revision:1})).status,200);
 const result=(await (await api(workspace)).json()).selected;
 assert.equal(result.limits_overridden,0);assert.equal(result.included_records_limit,120);assert.ok(result.records_bytes>120);
 assert.throws(()=>insert.run('blocked','x'),/WORKSPACE_STORAGE_FULL/);
 assert.equal(DB.raw.prepare("SELECT length(body) n FROM content_materials WHERE id='kept'").get().n,150);
 assert.equal((await api('',{...standard,revision:1,included_records_limit:500})).status,200);
 insert.run('released','x');
});
