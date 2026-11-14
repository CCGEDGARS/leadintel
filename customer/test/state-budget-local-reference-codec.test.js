const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../state-budget.js'),'utf8'),budget=require('../state-budget.js');
const PREFIX='leadintel-local-section-lzw-v1:';
function storageFixture(){
 class Storage{constructor(){this.values=new Map();this.writes=0;}getItem(key){return this.values.get(key)??null;}setItem(key,value){this.writes++;this.values.set(key,String(value));}}
 const root={Storage,localStorage:new Storage(),TextEncoder,TextDecoder,Buffer};vm.runInNewContext(source,root);return root;
}
test('pure local decoder restores current nested references and legacy whitespace/Unicode byte exactly without storage writes',()=>{
 const root=storageFixture(),key='leadintel_customer_v2_discovery',pointer={format:'leadintel-indexed-workspace-snapshot-v1',key:'leadintel_workspace_snapshot_v1:protected'};
 const evidence='Exact retained ā😀 evidence. '.repeat(4000);
 const canonical=JSON.stringify({original:{saved:pointer,evidence},latest:{evidence}}),legacy='  '+JSON.stringify({original:{saved:pointer,evidence}},null,2)+'\n';
 for(const [text,encoding]of [[canonical,'lzw16-jsonrefs-base64-v2'],[legacy,'lzw16-base64-v1']]){
  root.localStorage.setItem(key,text);const raw=root.localStorage.values.get(key),writes=root.localStorage.writes;
  assert.ok(raw.startsWith(PREFIX));assert.equal(JSON.parse(raw.slice(PREFIX.length)).encoding,encoding);
  assert.equal(budget.restoreLocalStorageValue(raw),text);assert.equal(budget.restoreLocalStorageValue(raw,key),text);assert.equal(root.localStorage.getItem(key),text);
  assert.equal(root.localStorage.writes,writes);assert.equal(root.localStorage.values.get(key),raw);
  assert.deepEqual(JSON.parse(budget.restoreLocalStorageValue(raw)).original.saved,pointer);
 }
});
test('pure local decoder leaves unencoded values unchanged and rejects malformed frames',()=>{
 for(const value of [null,undefined,'plain text','{"a":1}'])assert.equal(budget.restoreLocalStorageValue(value),value);
 for(const raw of [PREFIX+'{',PREFIX+'null',PREFIX+JSON.stringify({encoding:'unknown',data:'AAAA'}),PREFIX+JSON.stringify({encoding:'lzw16-base64-v1',data:'broken'})])assert.throws(()=>budget.restoreLocalStorageValue(raw));
});
// Valid LZW stream for a repeated character: each next code expands to one
// additional character, making the decoded-size limit test small on disk.
function repeatedCharacterFrame(words){const bytes=Buffer.alloc(words*2);for(let i=0;i<words;i++)bytes.writeUInt16BE(i===0?97:255+i,i*2);return PREFIX+JSON.stringify({encoding:'lzw16-base64-v1',data:bytes.toString('base64')});}
test('generic local reference decoding is bounded at 32 MB and section reads retain 8 MB limits',()=>{
 const over8=repeatedCharacterFrame(4200);assert.ok(budget.restoreLocalStorageValue(over8).length>8*1024*1024);
 assert.throws(()=>budget.restoreLocalStorageValue(over8,'leadintel_customer_v2_state'),/safe restore limit/);
 assert.equal(budget.restoreLocalStorageValue(over8,'leadintel_customer_v2_discovery').length,4200*4201/2);
 assert.throws(()=>budget.restoreLocalStorageValue(repeatedCharacterFrame(8200)),/safe restore limit/);
});
