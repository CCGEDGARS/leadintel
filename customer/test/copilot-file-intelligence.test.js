const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
test('Support never loads file intelligence and retired module cannot attach or import',()=>{
 const loader=fs.readFileSync(path.join(__dirname,'..','copilot-loader.js'),'utf8');
 const retired=fs.readFileSync(path.join(__dirname,'..','copilot-file-intelligence.js'),'utf8');
 assert.doesNotMatch(loader,/copilot-file-intelligence|fileIntelligence/);
 assert.doesNotMatch(retired,/type=.file|parseFile|importIntoReference|input.files/);
 assert.match(retired,/return false/);
});
