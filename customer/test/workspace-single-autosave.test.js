const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const bridge=fs.readFileSync(path.join(__dirname,'..','server-bridge.js'),'utf8');
const persistence=fs.readFileSync(path.join(__dirname,'..','workspace-persistence.js'),'utf8');
test('server bridge delegates scheduled storage edits to the persistence debounce instead of launching a competing cloud save',()=>{
 assert.match(bridge,/typeof root\.LeadIntelWorkspacePersistence\?\.saveWorkspace==='function'\)\{root\.dispatchEvent\(new CustomEvent\('leadintel:workspace-dirty'\)\);return;/);
 assert.match(persistence,/addEventListener\?\.\('leadintel:workspace-dirty',\(\)=>\{dirtySinceSave=true;saveError="";protectLocalChanges\(\);scheduleAutoSave\(\);\}\)/);
 assert.match(persistence,/const AUTOSAVE_DEBOUNCE_MS=2200/);
});
test('legacy fallback still queues a save when workspace persistence has not initialized',()=>{
 assert.match(bridge,/return;\}saveTimer=setTimeout\(\(\)=>saveNow\(\),1200\);/);
});
