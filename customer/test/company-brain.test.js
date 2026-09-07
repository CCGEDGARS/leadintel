const test=require('node:test');
const assert=require('node:assert/strict');
const Brain=require('../company-brain.js');

const ccgroupInput={
  profile:{
    companyName:'Coaching & Consulting Group',
    priorityOffers:'Corporate sales training; business mentoring; business coaching; AI integration; digital marketing; content creation',
    companyOverview:'Sales training and business coaching company integrating psychology, NLP and AI tools for business.',
    differentiation:'15,000+ sales visits; corporate training experience; NLP methodology',
    buyingOutcomes:''
  },
  answers:{buying_triggers:''},
  scrapedSources:[
    {id:'E1',url:'https://www.ccgroup.lv/',title:'Coaching & Consulting Group',text:'Corporate sales training, business mentoring, coaching, AI integration and digital tools for business. Sales professionals and managers improve selling, communication and leadership skills.'}
  ],
  documents:[]
};

test('classifies sales training and coaching as professional services',()=>{
  const classification=Brain.classifyCompany(ccgroupInput);
  assert.equal(classification.businessType,'professional-services');
  assert.ok(classification.offerCategories.includes('sales-training'));
  assert.ok(classification.offerCategories.includes('coaching'));
});

test('digital tools do not create warehouse or storage pain points',()=>{
  const pains=Brain.derivePainPoints(ccgroupInput.profile,ccgroupInput,'en');
  const text=pains.join(' ').toLowerCase();
  assert.doesNotMatch(text,/warehouse|workshop|storage|tools, materials|retrieval time/);
  assert.match(text,/sales|leadership|commercial|process|skills/);
});

test('professional services receive business-model appropriate signal candidates without generic capex defaults',()=>{
  const signals=Brain.recommendSignals(ccgroupInput);
  const ids=signals.map(signal=>signal.id);
  assert.ok(ids.includes('sales-leadership-change'));
  assert.ok(ids.includes('sales-team-hiring'));
  assert.ok(ids.includes('sales-transformation'));
  assert.ok(ids.includes('ai-sales-tech'));
  assert.ok(!ids.includes('facility-expansion'));
  assert.ok(!ids.includes('capital-investment'));
  assert.ok(!ids.includes('tender'));
});

test('tender is recommended only when procurement evidence or explicit user trigger supports it',()=>{
  assert.ok(!Brain.recommendSignals(ccgroupInput).some(signal=>signal.id==='tender'));
  const withTender={...ccgroupInput,answers:{buying_triggers:'Formal procurement tender or RFP'}};
  assert.ok(Brain.recommendSignals(withTender).some(signal=>signal.id==='tender'));
});

test('claims preserve status confidence and evidence references',()=>{
  assert.deepEqual(Brain.claim('Corporate sales training','confirmed','high',['E1']),{
    value:'Corporate sales training',status:'confirmed',confidence:'high',evidenceIds:['E1']
  });
});
