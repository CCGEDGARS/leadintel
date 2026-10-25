import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.join(__dirname,'..','..');
const indexPath=path.join(root,'index.html');

test('production root is the sign-in page: anonymous visitors are never forced into /customer/, the legacy chooser is gone',()=>{
  const html=fs.readFileSync(indexPath,'utf8');
  const redirects=html.match(/location\.replace\(['\"]\/customer\/['\"]\)/g)||[];
  assert.equal(redirects.length,1);
  assert.match(html,/response\.ok\)location\.replace\('\/customer\/'\)/,'the only workspace redirect follows a successful /api/session check');
  assert.match(html,/fetch\('\/api\/session'/);
  assert.match(html,/href=["']\/api\/auth\/google\/start["']/);
  assert.match(html,/href=["']\/api\/auth\/microsoft\/start["']/);
  assert.doesNotMatch(html,/href=["']LeadIntel\.html["']/);
  assert.doesNotMatch(html,/href=["']customer\/["']/);
});
