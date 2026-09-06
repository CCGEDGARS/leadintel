const test=require('node:test');
const assert=require('node:assert/strict');
const engine=require('../company-research-engine.js');

const QUESTION_IDS=['priority_offers','ideal_customer','lookalike_customers','buyer_roles','growth_markets','differentiation','buying_triggers','exclusions','opportunity_value','success_outcome'];

test('company research queries are domain-grounded and capped at three',()=>{
  const queries=engine.buildResearchQueries({website:'https://www.acme-industrial.com/',companyName:'Acme Industrial',targetMarkets:['Sweden','Nordics']},10);
  assert.ok(queries.length>0&&queries.length<=3);
  assert.ok(queries.every(item=>/acme-industrial\.com|Acme Industrial/i.test(item.query)));
  assert.ok(queries.some(item=>/Sweden|Nordics/i.test(item.query)));
  assert.deepEqual(queries.map(item=>item.id),[...new Set(queries.map(item=>item.id))]);
});

test('authoritative page discovery covers the five company evidence areas with bounded domain queries',()=>{
  const queries=engine.buildAuthoritativePageQueries({website:'https://www.acme-industrial.com/',companyName:'Acme Industrial'});
  assert.equal(queries.length,3);
  assert.ok(queries.every(item=>item.query.includes('site:acme-industrial.com')));
  assert.deepEqual([...new Set(queries.flatMap(item=>item.categories))].sort(),['company','contact','delivery','offers','proof']);
});

test('authoritative page candidates stay on the verified domain and retain one best page per evidence area',()=>{
  const rows=[
    {url:'https://acme-industrial.com/about-us',title:'About Acme',text:'Our company and history'},
    {url:'https://acme-industrial.com/products',title:'Products and solutions',text:'Industrial flooring products'},
    {url:'https://acme-industrial.com/case-studies',title:'Customer projects',text:'Completed factory projects'},
    {url:'https://acme-industrial.com/delivery',title:'Delivery and installation',text:'Installation and warranty service'},
    {url:'https://acme-industrial.com/contact',title:'Contacts',text:'Contact our team'},
    {url:'https://other.example/about',title:'Wrong company',text:'Foreign result'},
    {url:'https://acme-industrial.com/logo.png',title:'Logo',text:'Asset'}
  ];
  const selected=engine.selectAuthoritativePageCandidates(rows,'https://acme-industrial.com/',8);
  assert.deepEqual(selected.map(row=>row.pageCategory),['company','offers','proof','delivery','contact']);
  assert.ok(selected.every(row=>new URL(row.url).hostname==='acme-industrial.com'));
});

test('commercial confidence requires company, offer and proof-or-delivery evidence',()=>{
  const quality=engine.evaluateResearchQuality({
    website:'https://acme-industrial.com/',
    primary:[
      {type:'website',url:'https://acme-industrial.com/',title:'Acme',text:'Official company evidence',pageCategory:'company'},
      {type:'link',url:'https://acme-industrial.com/products',title:'Products',text:'Official products',pageCategory:'offers'},
      {type:'link',url:'https://acme-industrial.com/projects',title:'Projects',text:'Customer projects',pageCategory:'proof'}
    ]
  });
  assert.equal(quality.publishable,true);
  assert.equal(quality.coverage.minimumMet,true);
  assert.equal(quality.coverage.score,60);
  const weak=engine.evaluateResearchQuality({
    website:'https://acme-industrial.com/',
    primary:[{type:'website',url:'https://acme-industrial.com/',title:'Acme',text:'Official company evidence',pageCategory:'company'}]
  });
  assert.equal(weak.publishable,true,'research remains reviewable even when commercial coverage is incomplete');
  assert.equal(weak.coverage.minimumMet,false);
  assert.ok(weak.warnings.some(item=>/offer/i.test(item)));
});

test('high AI confidence is capped while authoritative company coverage is incomplete',()=>{
  const draft={priority_offers:{value:'Industrial flooring',confidence:'high',sourceIds:['S1'],rationale:'Official source'}};
  const capped=engine.capDraftConfidence(draft,{minimumMet:false});
  assert.equal(capped.priority_offers.confidence,'medium');
  assert.match(capped.priority_offers.rationale,/coverage incomplete/i);
  assert.equal(engine.capDraftConfidence(draft,{minimumMet:true}).priority_offers.confidence,'high');
});

test('public Firecrawl results are normalized, deduplicated and assigned valid source ids',()=>{
  const payload={data:[
    {url:'https://acme-industrial.com/cases',title:'Cases',markdown:'Factory flooring case studies'},
    {url:'https://acme-industrial.com/cases#section',title:'Duplicate',markdown:'Duplicate fragment'},
    {url:'https://industry.example/news/acme-expands',title:'Acme expands',description:'Acme Industrial expands production in Sweden.'},
    {url:'javascript:alert(1)',title:'Unsafe',description:'No'}
  ]};
  const rows=engine.normalizeSearchResults(payload,{id:'company-news',query:'Acme news'});
  assert.equal(rows.length,2);
  assert.deepEqual(rows.map(row=>row.id),['S1','S2']);
  assert.ok(rows.every(row=>/^https?:\/\//.test(row.url)));
  assert.ok(rows.some(row=>row.type==='public'));
  assert.ok(rows.every(row=>row.query==='Acme news'));
});

test('AI draft parser whitelists strategic fields, confidence and real evidence ids',()=>{
  const text='```json\n'+JSON.stringify({fields:{
    priority_offers:{value:'Industrial flooring',confidence:'high',source_ids:['S1','S9'],rationale:'Shown on product page'},
    buyer_roles:{value:'Facility Manager',confidence:'medium',source_ids:['S2'],rationale:'Role appears in case study'},
    opportunity_value:{value:'EUR 100,000',confidence:'extreme',source_ids:['S1'],rationale:'Invalid confidence must be rejected'},
    rogue_field:{value:'Ignore me',confidence:'high',source_ids:['S1'],rationale:'Unknown'}
  }})+'\n```';
  const parsed=engine.parseAiDraft(text,['S1','S2']);
  assert.equal(parsed.priority_offers.value,'Industrial flooring');
  assert.deepEqual(parsed.priority_offers.sourceIds,['S1']);
  assert.equal(parsed.buyer_roles.confidence,'medium');
  assert.equal(parsed.opportunity_value,undefined);
  assert.equal(parsed.rogue_field,undefined);
  assert.ok(Object.keys(parsed).every(key=>QUESTION_IDS.includes(key)));
});

test('draft merge fills blanks but never overwrites a non-empty customer answer',()=>{
  const current={priority_offers:'Customer-entered offer',ideal_customer:'',buyer_roles:'CEO'};
  const draft={
    priority_offers:{value:'AI offer',confidence:'high',sourceIds:['S1'],rationale:'Evidence'},
    ideal_customer:{value:'Industrial manufacturers',confidence:'medium',sourceIds:['S2'],rationale:'Evidence'},
    buyer_roles:{value:'Facility Manager',confidence:'medium',sourceIds:['S2'],rationale:'Evidence'}
  };
  const merged=engine.mergeDraft(current,draft);
  assert.equal(merged.answers.priority_offers,'Customer-entered offer');
  assert.equal(merged.answers.ideal_customer,'Industrial manufacturers');
  assert.equal(merged.answers.buyer_roles,'CEO');
  assert.equal(merged.meta.priority_offers.origin,'user');
  assert.equal(merged.meta.ideal_customer.origin,'research');
});

test('review actions are meaningful for research drafts and never show a dead Accept control for preserved user input',()=>{
  assert.deepEqual(engine.reviewActionState({origin:'user',reviewed:true}),{visible:false,label:'',disabled:true});
  assert.deepEqual(engine.reviewActionState({origin:'research',reviewed:false}),{visible:true,label:'Accept',disabled:false});
  assert.deepEqual(engine.reviewActionState({origin:'research',reviewed:true}),{visible:true,label:'Accepted ✓',disabled:true});
});

test('deterministic fallback is conservative and leaves unsupported commercial claims blank',()=>{
  const sources=[
    {id:'S1',type:'website',url:'https://acme-industrial.com/',title:'Acme Industrial | Industrial flooring and concrete repair',text:'Industrial flooring systems and concrete repair for factories, warehouses and food production facilities. Custom solutions and certified installation.'},
    {id:'S2',type:'public',url:'https://industry.example/acme',title:'Acme Industrial expands factory services',text:'Acme Industrial supports factory modernization and facility expansion projects.'}
  ];
  const draft=engine.buildEvidenceDraft({sources,targetMarkets:['Sweden']});
  assert.match(draft.priority_offers.value,/industrial flooring|concrete repair/i);
  assert.match(draft.ideal_customer.value,/factor|warehouse|food production/i);
  assert.equal(draft.opportunity_value.value,'');
  assert.equal(draft.success_outcome.value,'');
  assert.equal(draft.exclusions.value,'');
  assert.ok(['high','medium','low'].includes(draft.priority_offers.confidence));
  assert.ok(draft.priority_offers.sourceIds.length>0);
});

test('Latvian deterministic fallback never inserts English taxonomy or offer prose',()=>{
  const sources=[
    {id:'S1',type:'website',url:'https://example.lv/',title:'Example | Office furniture and warehouse equipment',text:'Office furniture for factories and warehouses. Custom solutions, fast delivery and certified installation. Procurement managers usually lead the purchase.'}
  ];
  const draft=engine.buildEvidenceDraft({sources,targetMarkets:['Latvia'],uiLanguage:'lv'});
  const visible=Object.values(draft).map(row=>row.value).filter(Boolean).join(' ');
  assert.match(draft.ideal_customer.value,/Ražotnes|Noliktavas/);
  assert.match(draft.buyer_roles.value,/Iepirkumu vadītāji/);
  assert.match(draft.differentiation.value,/Pielāgoti risinājumi|Ātra piegāde/);
  assert.equal(draft.priority_offers.value,'','an English page title must not leak into Latvian output');
  assert.doesNotMatch(visible,/\b(?:Factories|Warehouses|Procurement Manager|Custom solutions|Fast delivery|Office furniture)\b/i);
});

test('source merge keeps official evidence first and caps persisted research safely',()=>{
  const official=[{type:'website',url:'https://acme-industrial.com/',title:'Home',text:'Official'}];
  const publicRows=Array.from({length:20},(_,i)=>({type:'public',url:`https://news.example/${i}`,title:`News ${i}`,text:`Evidence ${i}`}));
  const merged=engine.mergeSources(official,publicRows,12);
  assert.equal(merged.length,12);
  assert.equal(merged[0].type,'website');
  assert.deepEqual(merged.map(row=>row.id),merged.map((_,i)=>`S${i+1}`));
});


test('filters research to the verified company domain and excludes assets or unrelated domains from primary evidence',()=>{
  const result=engine.filterResearchSources([
    {type:'website',url:'https://www.acme-industrial.com/',title:'Acme home',text:'Official company evidence'},
    {type:'link',url:'https://www.acme-industrial.com/services',title:'Services',text:'Official services'},
    {type:'public',url:'https://www.klozers.com/case-studies',title:'Unrelated result',text:'Wrong company evidence'},
    {type:'public',url:'https://images.example-cdn.com/logo.png',title:'Image',text:'Wrong asset'}
  ],'https://www.acme-industrial.com/');
  assert.deepEqual(result.primary.map(row=>row.url),[
    'https://www.acme-industrial.com/',
    'https://www.acme-industrial.com/services'
  ]);
  assert.deepEqual(result.supporting.map(row=>row.url),['https://www.klozers.com/case-studies']);
  assert.ok(result.excluded.some(row=>/asset/i.test(row.reason)));
});

test('research quality gate blocks publication when primary evidence is missing or foreign-domain evidence is present',()=>{
  const quality=engine.evaluateResearchQuality({
    website:'https://www.acme-industrial.com/',
    primary:[
      {type:'website',url:'https://www.acme-industrial.com/',title:'Acme',text:'Official company evidence'}
    ],
    supporting:[
      {type:'public',url:'https://www.klozers.com/about',title:'Other company',text:'Unrelated'}
    ],
    failures:0
  });
  assert.equal(quality.publishable,true);
  assert.equal(quality.checks.primaryDomainMatch,true);
  assert.equal(quality.checks.noForeignPrimaryEvidence,true);
  const blocked=engine.evaluateResearchQuality({
    website:'https://www.acme-industrial.com/',
    primary:[],
    supporting:[],
    failures:1
  });
  assert.equal(blocked.publishable,false);
  assert.ok(blocked.issues.some(issue=>/primary website evidence/i.test(issue)));
});

test('standard research envelope can carry up to 25 unique sources before quality filtering',()=>{
  const rows=Array.from({length:25},(_,i)=>({type:i===0?'website':'link',url:`https://acme-industrial.com/page-${i}`,title:`Page ${i}`,text:`Evidence ${i}`}));
  const merged=engine.mergeSources(rows,[],25);
  assert.equal(engine.RESEARCH_LIMITS.standard.maxPages,25);
  assert.equal(merged.length,25);
});

test('research limit messages expose the actual numeric budget instead of an unexpanded template token',()=>{
  const rows=Array.from({length:8},(_,i)=>({type:i===0?'website':'public',url:i===0?'https://acme-industrial.com/':`https://news.example/${i}`,title:`Source ${i}`,text:'x'.repeat(16000)}));
  const result=engine.filterResearchSources(rows,'https://acme-industrial.com/');
  const limited=result.excluded.find(row=>/character limit/i.test(row.reason));
  assert.ok(limited);
  assert.match(limited.reason,/100000/);
  assert.doesNotMatch(limited.reason,/\$\{/);
});

test('visible Latvian selection overrides stale English workspace state for research',()=>{
  assert.equal(engine.resolveResearchLanguage({selectorValue:'lv',storedValue:'en',navigatorLanguages:['en-US']}),'lv');
  assert.equal(engine.resolveResearchLanguage({selectorValue:'en',storedValue:'lv',navigatorLanguages:['lv-LV']}),'en');
  assert.equal(engine.resolveResearchLanguage({selectorValue:'auto',storedValue:'en',navigatorLanguages:['lv-LV','en-US']}),'lv');
});
