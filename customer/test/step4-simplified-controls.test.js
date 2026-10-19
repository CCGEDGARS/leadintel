const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ui=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
test('Step 4 secondary controls live inside Advanced research tools',()=>{
 const start=ui.indexOf('company-search-advanced');
 const end=ui.indexOf('</details>',start);
 assert.ok(start>0&&end>start);
 const section=ui.slice(start,end);
 for(const name of ['recheck-company-results','clear-company-results','manage-company-inputs','manage-known-companies','discovery-funnel']) assert.ok(section.includes(name),name);
 assert.match(ui,/Companies to find/);
 assert.match(ui,/Existing research and selections are preserved/);
 assert.doesNotMatch(ui,/class="company-search-details"/);
});
