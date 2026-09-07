const test=require('node:test');
const assert=require('node:assert/strict');
const LinkedIn=require('../linkedin-signals.js');

test('LinkedIn query builder creates public-index leadership, hiring and activity searches',()=>{
  const queries=LinkedIn.buildLinkedInQueries({researchMarkets:'Latvia',priorityOffers:'Sales training',decisionMakers:'Sales Director; CEO',marketFocus:'B2B growth'},[{name:'AI adoption',active:true,keywords:'AI; CRM'}],{mode:'deep',sourceTypes:['news','linkedin'],language:'en'});
  assert.ok(queries.length>=3);
  assert.ok(queries.some(item=>/site:linkedin\.com\/in|site:linkedin\.com\/company/.test(item.query)));
  assert.ok(queries.some(item=>/site:linkedin\.com\/jobs\/view/.test(item.query)));
  assert.ok(queries.every(item=>item.sourceType==='linkedin'));
  assert.ok(queries.every(item=>item.sourceKind==='linkedin-public-index'));
});

test('LinkedIn provenance distinguishes public index and Apollo identity links',()=>{
  assert.equal(LinkedIn.classifyLinkedInEvidence('https://www.linkedin.com/company/acme'),'linkedin-public-index');
  assert.equal(LinkedIn.apolloLinkedInProvenance('https://www.linkedin.com/in/jane-doe'),'apollo-linkedin-url');
  assert.equal(LinkedIn.classifyLinkedInEvidence('https://example.com/article'),'public-web');
  assert.doesNotMatch(JSON.stringify(LinkedIn),/linkedin-api/);
});

test('installer preserves LinkedIn source selection and replaces part of deep research plan',()=>{
  const api={
    RESEARCH_MODES:{quick:{maxQueries:4},deep:{maxQueries:12},intelligence:{maxQueries:24}},
    effectiveResearchMarkets:profile=>String(profile.researchMarkets||'').split(';').filter(Boolean),
    splitList:value=>Array.isArray(value)?value:String(value||'').split(/;|\n/).map(v=>v.trim()).filter(Boolean),
    buildResearchQueries:()=>Array.from({length:12},(_,i)=>({id:`base-${i}`,sourceType:'news',query:`base ${i}`})),
    filterResearchSourceTypes:types=>types.filter(type=>type!=='linkedin'),
    normalizeSearchResults:(payload,meta)=>[{url:'https://www.linkedin.com/company/acme',queryId:meta.id,sourceProviders:['openai']}],
    mergeResearchResults:(...groups)=>groups.flat(),
    normalizeMarketState:()=>({researchSourceTypes:['news'],researchResults:[{url:'https://www.linkedin.com/company/acme'}]})
  };
  LinkedIn.install(api,null);
  const planned=api.buildResearchQueries({researchMarkets:'Latvia',priorityOffers:'Sales training',decisionMakers:'Sales Director'},[],{mode:'deep',sourceTypes:['news','linkedin']});
  assert.equal(planned.length,12);
  assert.ok(planned.some(item=>item.sourceType==='linkedin'));
  assert.deepEqual(api.filterResearchSourceTypes(['news','linkedin'],[]),['news','linkedin']);
  const state=api.normalizeMarketState({researchSourceTypes:['news','linkedin']});
  assert.ok(state.researchSourceTypes.includes('linkedin'));
  assert.equal(state.researchResults[0].sourceKind,'linkedin-public-index');
});
