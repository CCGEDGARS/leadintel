const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const rootDir=path.join(__dirname,'..');
const modulePath=path.join(rootDir,'market-research-guard.js');

function fixture(){
  let hidden=true;
  let hiddenWrites=0;
  const panel={
    get hidden(){return hidden;},
    set hidden(value){hiddenWrites++;hidden=Boolean(value);},
    setAttribute(){},
    removeAttribute(){}
  };
  const root={document:{
    getElementById:id=>id==='research-run-preview'?panel:null,
    querySelector:()=>null
  }};
  return {root,panel,writes:()=>hiddenWrites};
}

test('protectPreview does not rewrite hidden when preview is already hidden',()=>{
  delete require.cache[require.resolve(modulePath)];
  const guard=require(modulePath);
  const {root,writes}=fixture();

  guard.protectPreview(root);
  guard.protectPreview(root);

  assert.equal(writes(),0,'an already-hidden preview must not be rewritten and retrigger MutationObserver');
});

test('setIdle does not rewrite hidden when preview is already hidden',()=>{
  delete require.cache[require.resolve(modulePath)];
  const guard=require(modulePath);
  const {root,writes}=fixture();

  guard.setIdle(root);
  guard.setIdle(root);

  assert.equal(writes(),0,'idle synchronization must not retrigger the hidden-attribute observer');
});

test('evidence bootstrap cache-busts the fixed market research guard',()=>{
  const evidence=fs.readFileSync(path.join(rootDir,'evidence-view.js'),'utf8');
  assert.match(evidence,/market-research-guard\.js\?v=20260908-render-loop-v1/);
});
