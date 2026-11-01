const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('market research mode controls are equal and idle until explicitly activated',()=>{
  const guard=read('market-research-guard.js');
  const evidence=read('evidence-view.js');

  assert.match(guard,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(guard,/height:112px!important/);
  assert.match(guard,/research-mode-idle/);
  assert.match(guard,/research-mode-selected/);
  assert.match(guard,/research-run-preview/);
  assert.match(guard,/\.hidden=true/);
  assert.match(guard,/Company profile context/);
  assert.match(evidence,/market-research-guard\.js/);
});

test('runtime and static research card tracks match their button heights at both breakpoints',()=>{
 const guard=read('market-research-guard.js'),css=read('market.css');
 for(const source of [guard,css]){assert.match(source,/grid-template-rows:112px 1fr/);assert.match(source,/height:112px!important/);assert.match(source,/@media\(max-width:760px\)/);assert.match(source,/grid-template-rows:100px 1fr/);assert.match(source,/height:100px!important/);}
 assert.doesNotMatch(guard,/height:(?:76|96)px!important/);
});
test('all three titles share a position while Recommended is centered independently below Market Research',()=>{
 const {JSDOM,VirtualConsole}=require('jsdom'),ux=require('../market-research-ux.js'),guard=require('../market-research-guard.js');
 const dom=new JSDOM('<div id="market-research-workbench"><div class="research-actions"><button id="run-market-research"></button><button id="run-detailed-research"></button><button id="run-market-intelligence"></button></div></div>',{url:'https://example.test/customer/',virtualConsole:new VirtualConsole()});
 const root=dom.window,style=root.document.createElement('style');style.textContent=read('market.css');root.document.head.append(style);
 try{
  ux.install(root);guard.install(root);root.document.dispatchEvent(new root.Event('DOMContentLoaded'));
  const titles=[...root.document.querySelectorAll('.research-mode-title')];assert.equal(titles.length,3);
  const positions=titles.map(node=>root.getComputedStyle(node));assert.ok(positions.every(p=>p.position==='absolute'));assert.ok(positions.every(p=>p.top===positions[0].top));assert.ok(positions.every(p=>p.textAlign==='center'));
  const badge=root.document.querySelector('#run-detailed-research .research-mode-badge'),position=root.getComputedStyle(badge);assert.equal(badge.textContent.toLowerCase(),'recommended');assert.equal(position.position,'absolute');assert.equal(position.left,'0px');assert.equal(position.right,'0px');assert.equal(position.transform,'none');assert.equal(position.textAlign,'center');assert.notEqual(position.top,positions[0].top);
 }finally{dom.window.close();}
});
