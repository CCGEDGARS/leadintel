import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(path)=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const html=read('index.html'),css=read('copilot.css'),loader=read('copilot-loader.js'),ui=read('copilot-ui.js');
const HINT='Ask about your workspace, companies, markets, sales strategy or tools. LeadIntel can research public sources, explain findings and help you decide your next step.';

test('Ask LeadIntel is a resident bottom-right launcher with a mascot, not a sidebar card',()=>{
  assert.doesNotMatch(html,/utility-card utility-ai/);
  const entry=html.match(/<button class="leadintel-copilot-entry"[\s\S]*?<\/button>/)[0];
  assert.match(entry,/aria-controls="leadintel-copilot-drawer"/);
  assert.match(entry,/aria-describedby="leadintel-copilot-hint"/);
  assert.match(entry,/<svg class="copilot-mascot"[^>]*aria-hidden="true"/);
  assert.equal((entry.match(/class="copilot-pupil"/g)||[]).length,2,'two pupils that can follow the pointer');
  assert.match(entry,/copilot-entry-subtitle">Business & Research/);
  // The hint is the button's description, not part of its name: aria-hidden keeps the name "Ask LeadIntel ✦ Business & Research".
  assert.ok(entry.includes(`<span class="copilot-entry-hint" id="leadintel-copilot-hint" role="tooltip" aria-hidden="true">${HINT}</span>`));
  assert.match(css,/\.leadintel-copilot-entry\{[^}]*position:fixed[^}]*right:\d+px[^}]*bottom:\d+px/s);
});

test('the mascot breathes and blinks, the hint appears only on hover or focus, and reduced motion switches animation off',()=>{
  assert.match(css,/@keyframes copilot-breathe/);
  assert.match(css,/@keyframes copilot-blink/);
  assert.match(css,/\.copilot-pupil\{transform:translate\(var\(--pupil-x,0px\),var\(--pupil-y,0px\)\)/);
  assert.match(css,/\.copilot-entry-hint\{[^}]*opacity:0[^}]*pointer-events:none/s);
  assert.match(css,/\.leadintel-copilot-entry:hover \.copilot-entry-hint,\.leadintel-copilot-entry:focus-visible \.copilot-entry-hint\{opacity:1/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{\.copilot-mascot-body,\.copilot-eye,\.copilot-mascot-spark\{animation:none\}/);
});

test('the drawer slides in from the right edge instead of appearing over the page',()=>{
  assert.match(css,/\.leadintel-copilot-drawer\{[^}]*transform:translateX\(104%\)[^}]*transition:transform/s);
  assert.match(css,/\.leadintel-copilot-drawer\.is-open\{transform:none\}/);
  assert.match(ui,/function showDrawer\(panel\)\{panel\.hidden=false;/);
  assert.match(ui,/classList\.add\('is-open'\)/);
  assert.match(ui,/function closeCopilot\(\)\{if\(!drawer\)return;drawer\.classList\.remove\('is-open'\)/);
  // The page makes room for the drawer instead of being covered by it (overlay only on narrow screens).
  assert.match(css,/html\.leadintel-copilot-open body\{padding-right:min\(430px,94vw\)\}/);
  assert.match(css,/@media\(max-width:720px\)\{html\.leadintel-copilot-open body\{padding-right:0\}\}/);
  assert.match(ui,/html\.classList\.add\('leadintel-copilot-open'\)/);
  assert.match(ui,/documentElement\.classList\.remove\('leadintel-copilot-open'\)/);
});

test('pupil offsets point at the pointer, stay inside the eye and rest at centre without a pointer',async()=>{
  const {pupilOffset}=await import('../copilot-loader.js?test=mascot');
  assert.deepEqual(pupilOffset({x:100,y:100},{x:100,y:100}),{x:0,y:0});
  assert.deepEqual(pupilOffset(null,{x:0,y:0}),{x:0,y:0});
  const far=pupilOffset({x:1000,y:100},{x:100,y:100});
  assert.equal(far.x,2.4);assert.equal(far.y,0);
  const up=pupilOffset({x:100,y:-900},{x:100,y:100});
  assert.equal(up.x,0);assert.equal(up.y,-3.2);
  const near=pupilOffset({x:140,y:100},{x:100,y:100});
  assert.ok(near.x>0&&near.x<2.4,'a close pointer moves the pupil only part of the way');
  for(const point of [{x:-5000,y:3000},{x:7,y:-9},{x:1e6,y:1e6}]){const o=pupilOffset(point,{x:0,y:0});assert.ok(Math.abs(o.x)<=2.4&&Math.abs(o.y)<=3.2);}
});

test('the loader tracks the pointer without touching document.body or observing the DOM',()=>{
  assert.match(loader,/addEventListener\('pointermove'/);
  assert.match(loader,/setProperty\('--pupil-x'/);
  assert.doesNotMatch(loader,/document\.body|MutationObserver/);
  assert.match(loader,/copilot\.css\?v=20261025-mascot-v1/);
  assert.match(ui,/copilot\.css\?v=20261025-mascot-v1/);
});
