const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const styles=fs.readFileSync(path.join(root,'styles.css'),'utf8');

test('workspace reset does not use a native browser confirmation dialog',()=>{
  assert.doesNotMatch(app,/window\.confirm\s*\(/);
});

test('workspace reset uses a five-second inline confirm state on the existing button',()=>{
  assert.match(app,/RESET_CONFIRM_WINDOW_MS\s*=\s*5000/);
  assert.match(app,/dataset\.resetArmed\s*=\s*["']true["']/);
  assert.match(app,/Confirm reset/);
  assert.match(app,/setTimeout\([^\n]*RESET_CONFIRM_WINDOW_MS\)/);
  assert.match(styles,/\.ghost-btn\.reset-armed/);
});
