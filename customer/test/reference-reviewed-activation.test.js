import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../reference-customer-library-ui.js',import.meta.url),'utf8');
const start=source.indexOf("document.addEventListener('click',event=>{");
const end=source.indexOf('  },true);',start);
const handler=source.slice(start,end+10);
test('reviewed profile publishes fresh analysis instead of toggling an already active saved list',async()=>{
  let listener,published=0,toggled=0,stopped=0;
  const button={disabled:false,dataset:{activateReferenceList:'active-list'}};
  vm.runInNewContext(handler,{
    document:{addEventListener:(_,fn)=>listener=fn},
    blockOnUnsavedDraft:()=>false,
    publishSelected:async b=>{assert.equal(b,button);published++;},
    activateList:async()=>toggled++,
  });
  listener({target:{closest:selector=>['[data-activate-reviewed-profile]','[data-activate-reference-list]'].includes(selector)?button:null},preventDefault(){},stopPropagation(){},stopImmediatePropagation(){stopped++;}});
  await Promise.resolve();
  assert.equal(published,1);assert.equal(toggled,0);assert.equal(stopped,1);
});
