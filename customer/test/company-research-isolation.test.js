const test=require('node:test');const assert=require('node:assert/strict');
const isolation=require('../workspace-isolation.js');
const storage=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)};};
test('fresh company research survives app state reads before Discovery ever runs',()=>{
 const s=storage(),meta=JSON.stringify({website:'https://www.sample.example/',generatedAt:'2026-10-18',fields:{}});s.setItem(isolation.RESEARCH_META_KEY,meta);s.setItem(isolation.DIRTY_KEY,'{"workspace_id":"w1"}');
 for(let i=0;i<3;i++)assert.equal(isolation.reconcileLocalWorkspace(s,{website:'www.sample.example'}).cleared,false);
 assert.equal(s.getItem(isolation.RESEARCH_META_KEY),meta);assert.ok(s.getItem(isolation.DIRTY_KEY));
});
test('stale unscoped discovery is removed without deleting independently scoped current company research',()=>{
 const s=storage(),meta=JSON.stringify({website:'https://sample.example',generatedAt:'2026-10-18'});s.setItem(isolation.RESEARCH_META_KEY,meta);s.setItem(isolation.DISCOVERY_KEY,JSON.stringify({pipeline:[{domain:'old.example'}]}));
 assert.equal(isolation.reconcileLocalWorkspace(s,{website:'sample.example'}).cleared,true);assert.equal(s.getItem(isolation.DISCOVERY_KEY),null);assert.equal(s.getItem(isolation.RESEARCH_META_KEY),meta);
});
test('research for a different seller is still removed on company change',()=>{
 const s=storage();s.setItem(isolation.RESEARCH_META_KEY,JSON.stringify({website:'old.example',generatedAt:'2026-10-18'}));
 assert.equal(isolation.reconcileLocalWorkspace(s,{website:'new.example'}).cleared,true);assert.equal(s.getItem(isolation.RESEARCH_META_KEY),null);
});
