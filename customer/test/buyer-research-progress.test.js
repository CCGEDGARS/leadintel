const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ui=fs.readFileSync(path.join(__dirname,'../discovery-ui.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../discovery.css'),'utf8');

test('buyer research exposes five meaningful live phases',()=>{
 for(const label of ['Verifying company','buyer-role categories','Identifying and ranking relevant people','Verifying identities and current roles','Finalizing public contact evidence']) assert.ok(ui.includes(label),label);
 assert.match(ui,/buyerResearchProgressHtml/);
 assert.match(ui,/Still working — verified results will appear here automatically/);
});

test('search button communicates active research rather than looking disabled',()=>{
 assert.match(ui,/Researching decision-makers…/);
 assert.match(css,/\.buyer-research-spinner/);
 assert.match(css,/@keyframes buyerResearchSpin/);
});

test('buyer progress has accessible live status and bounded progress bar',()=>{
 assert.match(ui,/role="status" aria-live="polite"/);
 assert.match(ui,/buyer-research-progress-bar/);
 assert.match(css,/\.buyer-research-progress ol/);
});
