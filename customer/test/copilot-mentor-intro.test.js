import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const source=fs.readFileSync(new URL('../copilot-ui.js',import.meta.url),'utf8');
test('the approved mentor introduction is exact, compact by default and expands capabilities accessibly',async()=>{
 const dom=new JSDOM('<button id="leadintel-copilot-entry"></button>'),prior={window:globalThis.window,document:globalThis.document};Object.assign(globalThis,{window:dom.window,document:dom.window.document});
 try{dom.window.LeadIntelServerBridge={workspace:{id:'w1'}};dom.window.LeadIntelWorkspacePersistence={isExplicitlySaved:()=>true,hasUnsavedChanges:()=>false};const mod=await import(`data:text/javascript;base64,${Buffer.from(source+'\n//mentor-intro').toString('base64')}`);const panel=await mod.openCopilot({context:{currentCopilotScreenContext:()=>({step:6})},api:{bootstrapCopilot:async()=>({ai:{configured:true}})}});
 const intro=panel.querySelector('[data-copilot-intro]');assert.equal(intro.querySelector('.copilot-intro-title').textContent,'Your AI business mentor. Every step of the way.');assert.equal(intro.querySelector('.copilot-intro-copy').textContent,'Get help with any step, spot missing information, check quality and improve your approach. Research companies and markets, compare findings and explore your next business move—with advice tailored to your business.');assert.ok(intro.classList.contains('is-collapsed'));const toggle=intro.querySelector('[data-copilot-intro-toggle]');assert.equal(toggle.textContent,'Explore capabilities');assert.equal(toggle.getAttribute('aria-expanded'),'false');toggle.click();assert.equal(toggle.getAttribute('aria-expanded'),'true');assert.match(intro.textContent,/drafts/i);assert.match(intro.textContent,/never change/i);assert.doesNotMatch(intro.textContent,/book.to.skill|all personal data/i);
 }finally{dom.window.close();Object.assign(globalThis,prior);}
});
