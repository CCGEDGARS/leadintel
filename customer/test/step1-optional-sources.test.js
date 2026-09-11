const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');

test('Step 1 tolerates the removed optional additional-links input',()=>{
  assert.match(app,/const additionalLinks=\$\("additional-links"\)/);
  assert.match(app,/additionalLinks\?\.value\|\|""/);
  assert.match(app,/if\(additionalLinks\)additionalLinks\.value=/);
});

test('Step 1 continues reading and validating the required company website',()=>{
  assert.match(app,/state\.website=LeadIntelProfile\.normalizeUrl\(\$\("company-website"\)\.value\)/);
  assert.match(app,/if\(!state\.website\)/);
});
