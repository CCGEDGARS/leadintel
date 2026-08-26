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

test('source merge keeps official evidence first and caps persisted research safely',()=>{
  const official=[{type:'website',url:'https://acme-industrial.com/',title:'Home',text:'Official'}];
  const publicRows=Array.from({length:20},(_,i)=>({type:'public',url:`https://news.example/${i}`,title:`News ${i}`,text:`Evidence ${i}`}));
  const merged=engine.mergeSources(official,publicRows,12);
  assert.equal(merged.length,12);
  assert.equal(merged[0].type,'website');
  assert.deepEqual(merged.map(row=>row.id),merged.map((_,i)=>`S${i+1}`));
});
