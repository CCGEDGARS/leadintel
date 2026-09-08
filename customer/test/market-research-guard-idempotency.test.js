const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');

const modulePath=path.join(__dirname,'..','market-research-guard.js');

test('protectPreview does not rewrite hidden when preview is already hidden',()=>{
  delete require.cache[require.resolve(modulePath)];
  const guard=require(modulePath);
  let hidden=true;
  let hiddenWrites=0;
  const panel={
    get hidden(){return hidden;},
    set hidden(value){hiddenWrites++;hidden=Boolean(value);},
    setAttribute(){},
    removeAttribute(){}
  };
  const root={document:{getElementById:id=>id==='research-run-preview'?panel:null}};

  guard.protectPreview(root);
  guard.protectPreview(root);

  assert.equal(hiddenWrites,0,'an already-hidden preview must not be rewritten and retrigger MutationObserver');
});
