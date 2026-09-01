import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.join(__dirname,'..','..');
const indexPath=path.join(root,'index.html');

test('production root remains a real LeadIntel entry page and does not force visitors into /customer/',()=>{
  const html=fs.readFileSync(indexPath,'utf8');
  assert.doesNotMatch(html,/location\.replace\(['\"]\/customer\/['\"]\)/);
  assert.match(html,/href=["']customer\/["']/);
  assert.match(html,/href=["']LeadIntel\.html["']/);
});
