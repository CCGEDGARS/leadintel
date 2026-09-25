const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'ai-settings.js'),'utf8');
const extension=fs.readFileSync(path.join(root,'service-settings-extension.js'),'utf8');
const discovery=fs.readFileSync(path.join(root,'discovery-ui.js'),'utf8');
const fragment=source.slice(source.indexOf('async function checkFirecrawlStatus(){'),source.indexOf('async function checkGmailStatus(){'));

function health({provider,observed={},status=200}={}){
  const context={
    api:async()=>({response:{ok:status===200,status},payload:{providers:provider?[{provider:'firecrawl',...provider}]:[]}}),
    window:{LeadIntelDiscoveryUI:{firecrawlHealth:()=>observed}},
    formatDateTime:()=> '25 Sep 2026, 20:22'
  };
  vm.runInNewContext(`${fragment}\nglobalThis.run=checkFirecrawlStatus;`,context);
  return context.run();
}

test('managed Firecrawl HTTP 402 tells the user whose credits need attention',async()=>{
  const result=await health({provider:{source:'managed',state:'good',metadata:{proxy_status:200}},observed:{blocked:true,lastRunAt:'2026-09-25T17:22:00.000Z'}});
  assert.equal(result.state,'bad');assert.equal(result.source,'managed');
  assert.match(result.detail,/LeadIntel must restore managed Firecrawl credits or billing/);
  assert.match(result.detail,/you do not need to top up your own account/);
});

test('a customer Firecrawl key with no balance gets an actionable warning',async()=>{
  const result=await health({provider:{source:'customer',state:'good',metadata:{remaining_credits:0}}});
  assert.equal(result.state,'bad');assert.equal(result.label,'No Firecrawl credits');
  assert.match(result.detail,/Your Firecrawl account reports zero/);
});

test('proxy reachability alone never confirms managed search credits',async()=>{
  const result=await health({provider:{source:'managed',state:'good',metadata:{proxy_status:200}}});
  assert.equal(result.state,'warn');assert.equal(result.label,'Credits unverified');
});

test('a confirmed customer balance is distinguished from a paid search check',async()=>{
  const result=await health({provider:{source:'customer',state:'good',metadata:{remaining_credits:321}}});
  assert.equal(result.state,'good');assert.match(result.detail,/321 remaining credits/);
  assert.match(result.detail,/not a paid search/);
});

test('Health reads saved Discovery HTTP 402 and keeps extension badges from hiding it',()=>{
  assert.match(discovery,/window\.LeadIntelDiscoveryUI\.firecrawlHealth=/);
  assert.match(extension,/window\.LeadIntelIntegrationHealth\?\.firecrawl/);
  assert.match(extension,/badge\.textContent=observed\?\.label\|\|statusLabel\(row\)/);
  assert.match(extension,/Firecrawl needs attention/);
  assert.match(source,/window\.LeadIntelIntegrationHealth=\{firecrawl\}/);
});
