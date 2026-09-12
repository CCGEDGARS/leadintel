import test from 'node:test';
import assert from 'node:assert/strict';
import {handleCopilotFileRoute} from '../src/copilot-file-routes.js';
import {runtime as sqliteRuntime,uploadRequest,apiRequest,hash} from './helpers/copilot-runtime.mjs';
const runtime=()=>{const env=sqliteRuntime();env.DB.sqlite.function('unixepoch',()=>1800000000);return env;};
test('upload is limited per user across workspaces before parsing a denied body',async()=>{
  const env=runtime();for(let i=0;i<20;i++)assert.ok([200,201].includes((await handleCopilotFileRoute(uploadRequest({workspace:i%2?'w2':'w1'}),env)).status));
  const request=uploadRequest(),getReader=request.body.getReader.bind(request.body);let read=false;request.body.getReader=()=>{read=true;return getReader();};
  const denied=await handleCopilotFileRoute(request,env);assert.equal(denied.status,429);assert.ok(Number(denied.headers.get('Retry-After'))>0);assert.equal(read,false);assert.doesNotMatch(await denied.text(),/Useful facts|leadintel_session/);
  assert.equal((await handleCopilotFileRoute(uploadRequest({token:'other'}),env)).status,200);
});
test('workspace upload budget is shared across different members',async()=>{
  const env=runtime();for(let user=3;user<=4;user++){env.DB.sqlite.prepare('INSERT INTO users(id) VALUES(?)').run(`u${user}`);env.DB.sqlite.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(`user${user}`),`u${user}`,'2999-01-01');env.DB.sqlite.prepare('INSERT INTO workspace_members VALUES(?,?,?)').run('w1',`u${user}`,'owner');}
  for(const token of ['good','other','user3'])for(let i=0;i<20;i++)assert.ok([200,201].includes((await handleCopilotFileRoute(uploadRequest({token}),env)).status));
  assert.equal((await handleCopilotFileRoute(uploadRequest({token:'user4'}),env)).status,429);
});
test('concurrent D1-backed rate reservations cannot overshoot a user budget',async()=>{
  const env=runtime();const responses=await Promise.all(Array.from({length:30},()=>handleCopilotFileRoute(uploadRequest(),env)));assert.equal(responses.filter(r=>r.status===429).length,10);assert.ok(responses.filter(r=>r.status!==429).every(r=>[200,201,409].includes(r.status)));
});
test('lifecycle reads also have a bounded user budget',async()=>{const env=runtime();for(let i=0;i<120;i++)assert.equal((await handleCopilotFileRoute(apiRequest('file-analyses'),env)).status,200);assert.equal((await handleCopilotFileRoute(apiRequest('file-analyses'),env)).status,429);});
test('a new rate window resets counters in place',async()=>{const env=runtime();for(let i=0;i<20;i++)await handleCopilotFileRoute(uploadRequest(),env);assert.equal((await handleCopilotFileRoute(uploadRequest(),env)).status,429);env.DB.sqlite.function('unixepoch',()=>1800000060);assert.equal((await handleCopilotFileRoute(uploadRequest(),env)).status,200);assert.equal(env.DB.sqlite.prepare('SELECT count(*) AS n FROM copilot_file_rate_limits').get().n,2);});
test('rate storage failure fails closed before accepting uploads',async()=>{const env=runtime();env.DB.sqlite.exec('DROP TABLE copilot_file_rate_limits');assert.equal((await handleCopilotFileRoute(uploadRequest(),env)).status,503);assert.equal(env.COPILOT_FILES.objects.size,0);});
