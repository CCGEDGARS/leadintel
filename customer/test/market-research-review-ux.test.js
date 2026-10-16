const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const {JSDOM}=require('jsdom');
const review=require('../market-research-review-ux.js');

test('source count and quoted plan themes settle the real preview observer',async()=>{
  const dom=new JSDOM('<body><section id="research-run-preview"><div class="research-preview-queries"><ol id="research-preview-queries"></ol></div><div id="research-suggested-sources"><div class="source-discovery-card"></div></div></section></body>',{url:'https://example.test/customer/'});
  const root=dom.window,queue=[];root.setTimeout=callback=>queue.push(callback);
  root.document.getElementById('research-preview-queries').dataset.plannedThemes=JSON.stringify(['Customer\'s "AI" & <support>']);
  const NativeObserver=root.MutationObserver,observers=[];
  root.MutationObserver=class extends NativeObserver{constructor(callback){super(callback);observers.push(this);}};
  async function settle(){for(let i=0;i<12;i++){await Promise.resolve();const callback=queue.shift();if(!callback)break;callback();}await Promise.resolve();assert.equal(queue.length,0,'preview observer must stop scheduling itself');}
  try{
    review.install(root);await settle();
    const status=root.document.querySelector('.source-discovery-complete');
    assert.match(status.textContent,/1 relevant sources/);
    assert.equal(root.document.querySelector('.research-plan-theme').textContent,'Customer\'s "AI" & <support>');
    assert.equal(root.document.querySelector('.research-plan-theme support'),null);
    const list=root.document.getElementById('research-suggested-sources');
    list.append(root.document.createElement('div'));list.lastChild.className='source-discovery-card';await settle();
    assert.equal(root.document.querySelector('.source-discovery-complete'),status,'unchanged count component is retained');
    assert.match(status.textContent,/2 relevant sources/);
    list.querySelectorAll('.source-discovery-card').forEach(node=>node.remove());await settle();
    assert.equal(list.querySelector('.source-discovery-complete'),null);
  }finally{observers.forEach(observer=>observer.disconnect());dom.window.close();}
});

test('research review uses compact plan with exact searches collapsed',()=>{
  const ux=read('market-research-review-ux.js');
  assert.match(ux,/Research Plan/);
  assert.match(ux,/View exact searches/);
  assert.match(ux,/research-plan-themes/);
  assert.match(ux,/planned-searches/);
  assert.match(ux,/details/);
});

test('research modes expose clear depth metadata',()=>{
  const ux=read('market-research-review-ux.js');
  assert.match(ux,/Fast/);
  assert.match(ux,/Detailed/);
  assert.match(ux,/Comprehensive/);
  assert.match(ux,/up to 20 evidence sources/i);
  assert.match(ux,/up to 80 evidence sources/i);
  assert.match(ux,/up to 200 evidence sources/i);
});

test('source discovery reports completed source count',()=>{
  const ux=read('market-research-review-ux.js');
  assert.match(ux,/relevant sources found/);
  assert.match(ux,/source-discovery-card/);
});

test('review UX module is loaded by evidence view',()=>{
  const evidence=read('evidence-view.js');
  assert.match(evidence,/market-research-review-ux\.js/);
});

test('Ercon preview themes come from the actual industrial plan, never static sales examples',()=>{
  const Market=require('../market-engine.js'),Ux=require('../market-research-review-ux.js');
  const signals=[{name:'Industrial project announcements',active:true,weight:3},{name:'Production facility expansion',active:true,weight:2},{name:'Capital investment',active:true,weight:1}];
  const profile={priorityOffers:'Industrial engineering and installation',idealCustomer:'Industrial manufacturers',targetMarkets:'Sweden'};
  for(const mode of ['quick','deep','intelligence']){
    const plan=Market.buildResearchPlan(profile,signals,{mode,sourceTypes:['news']});
    const themes=Ux.themesFromPlan(plan.map(item=>item.signalName||item.researchCategory));
    assert.ok(themes.includes('Industrial project announcements'));
    assert.doesNotMatch(themes.join(' '),/sales.team|leadership|team growth/i);
    assert.doesNotMatch(plan.map(item=>item.query).join(' '),/sales.team/i);
  }
  assert.deepEqual(Ux.themesFromPlan(['Sales team hiring','Sales team hiring']),['Sales team hiring'],'a real selected sales signal remains valid for a sales seller');
  assert.deepEqual(Ux.themesFromPlan([]),[],'no invented themes when no plan exists');
});
