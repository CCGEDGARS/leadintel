const test=require('node:test');
const assert=require('node:assert/strict');
const UI=require('../intelligence-profile-ui.js');

test('Step 3 exposes exactly eight executive intelligence fields and omits marketFocus from primary cards',()=>{
  assert.deepEqual(UI.CORE_FIELDS,['priorityOffers','idealCustomer','targetMarkets','customerPainPoints','buyingTriggers','decisionMakers','differentiation','commercialObjective']);
  assert.equal(UI.CORE_FIELDS.includes('marketFocus'),false);
});

test('primary card renders canonical provenance and confidence',()=>{
  const html=UI.renderCoreCard('customerPainPoints',{value:'Inconsistent sales execution',status:'ai_inferred_first_party',provenance:'ai_inference',confidence:'medium',sourceIds:['W1']},false);
  assert.match(html,/Customer Problems/);
  assert.match(html,/AI inferred from first-party evidence/i);
  assert.match(html,/Medium confidence/i);
});

test('profile quality distinguishes known needs-confirmation and missing fields',()=>{
  const html=UI.renderProfileQuality([{field:'priorityOffers',state:'known'},{field:'customerPainPoints',state:'needs_confirmation'},{field:'decisionMakers',state:'missing'}]);
  assert.match(html,/1 known/i);
  assert.match(html,/1 needs confirmation/i);
  assert.match(html,/1 missing/i);
});

test('contradictions remain hidden when none exist and render review message when present',()=>{
  assert.equal(UI.renderContradictions([]),'');
  const html=UI.renderContradictions([{field:'idealCustomer',canonicalClaim:'Enterprise customers',conflictingClaim:'SMEs',resolution:'Primary retained · review recommended'}]);
  assert.match(html,/Enterprise customers/);
  assert.match(html,/SMEs/);
  assert.match(html,/Primary retained/i);
});

test('intelligence profile does not repeat the Lookalike Audience entry point',()=>{
  const html=UI.render({canonical:{fields:{},diagnostics:[],contradictions:[]}}, {referenceCustomers:{activated:true,activeIds:['a','b'],dna:{confidence:'high'}},targetMarkets:['Germany']});
  assert.doesNotMatch(html,/reference-customer-summary|Teach LeadIntel what a great customer looks like|Upload & Analyze Customers/i);
  assert.equal(typeof UI.renderReferenceCustomerSummary,'undefined');
  assert.match(html,/Core Profile Quality/);
  assert.match(html,/Supporting Context/);
});

test('supporting context is expanded by default and uses a spacious review grid',()=>{
  const html=UI.renderSupporting({companyOverview:'Industrial engineering',currentMarkets:['Sweden'],buyingOutcomes:'Faster delivery'},{activated:false});
  assert.match(html,/<details class="intel-supporting" open>/);
  assert.match(html,/intel-supporting-grid/);
  assert.match(html,/Industrial engineering/);
});
