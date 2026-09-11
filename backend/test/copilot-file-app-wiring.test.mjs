import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const app=fs.readFileSync(path.join(here,'..','src','app.js'),'utf8');

test('mounts file upload routes before the generic Copilot router',()=>{
  assert.match(app,/import \{handleCopilotFileRoute\} from '\.\/copilot-file-routes\.js';/);
  const fileRoute=app.indexOf('handleCopilotFileRoute(request,env,cors)');
  const genericRoute=app.indexOf('handleCopilotRoute(request,env,cors)');
  assert.ok(fileRoute>=0&&fileRoute<genericRoute);
});
