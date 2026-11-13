const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js');
const rule='companies with less than 30 people';
const company=text=>({company:'Nordic Works',domain:'nordic.example',market:'Denmark',evidence:[{url:'https://nordic.example/about',text,sourceRead:true,verifiedAt:new Date().toISOString()}]});
const prose=text=>'Nordic Works manufactures steel components in Denmark for industrial equipment projects. '+text;
test('the owner headcount rule is resolved from attributed official operating evidence',()=>{
 for(const text of ['We employ 120 people.','Our company has 30 employees.','Number of employees: 51–200.','We have more than 100 employees.'])assert.equal(D.evaluateExclusions(company(prose(text)),rule).status,'clear',text);
 for(const text of ['We employ 12 people.','Number of employees: 11–20.'])assert.equal(D.evaluateExclusions(company(prose(text)),rule).status,'excluded',text);
});
test('headcount stays unconfirmed for missing, ambiguous, conflicting, third-party and unrelated numbers',()=>{
 for(const text of ['We manufacture 120 products.','Our customers employ 120 people.','Number of employees: 11–50.','We have 120 employees. We employ 12 people.'])assert.equal(D.evaluateExclusions(company(prose(text)),rule).status,'unverified',text);
 const c=company(prose('We employ 120 people.'));c.evidence[0].sourceRead=false;assert.equal(D.evaluateExclusions(c,rule).status,'unverified');
 c.evidence[0].sourceRead=true;c.evidence[0].url='https://other.example/about';assert.equal(D.evaluateExclusions(c,rule).status,'unverified');
});
test('combined sector exclusions reject direct producers without excluding their equipment suppliers',()=>{
 assert.equal(D.evaluateExclusions(company(prose('We manufacture pharmaceutical products.')),'businesses unrelated to industrial manufacturing, engineering/EPC or industrial asset ownership. Food and Pharma industries').status,'excluded');
 assert.equal(D.evaluateExclusions(company(prose('We produce food ingredients.')),'businesses unrelated to industrial manufacturing, engineering/EPC or industrial asset ownership. Food and Pharma industries').status,'excluded');
 assert.equal(D.evaluateExclusions(company(prose('We manufacture steel equipment for food and pharmaceutical customers.')),'Food and Pharma industries').status,'clear');
});
test('missing headcount evidence creates a criterion-specific verification query',()=>{
 const c=company(prose('We provide welded steel components.')),profile={priorityOffers:'steel manufacturing',targetMarkets:'Denmark',exclusions:rule};
 const plan=D.companyEvidencePlan(c,profile,{},{});assert.equal(plan.verificationFocus,'exclusions');
 const [q]=D.buildCandidateVerificationQueries([{...c,verificationFocus:plan.verificationFocus}],profile,{},1,{includeIndependent:false});
 assert.match(q.query,/employees|headcount/);assert.match(q.query,/site:nordic.example/);assert.doesNotMatch(q.query,/after:|news/);
});
test('a verified exclusion is terminal and must not buy another evidence search',()=>{
 const plan=D.companyEvidencePlan(company(prose('We employ 12 people.')),{priorityOffers:'steel manufacturing',targetMarkets:'Denmark',exclusions:rule},{},{});
 assert.equal(plan.hardFailure,true);assert.equal(plan.needsWeb,false);assert.ok(plan.assessment.gaps.some(g=>/excluded by approved/i.test(g)));
});

test('equipment suppliers are not excluded as food or pharmaceutical producers',()=>{
 for(const text of ['We manufacture food processing equipment.','We manufacture pharmaceutical packaging machinery.']){
  const c=company(prose(text));assert.equal(D.evaluateExclusions(c,'Food and Pharma industries').status,'clear',text);
 }
});
test('open-ended employee counts cannot prove a company is below the minimum',()=>{
 const rule='companies with less than 100 people';
 for(const text of ['Number of employees: 50+','We employ 50+ employees.'])assert.equal(D.evaluateExclusions(company(prose(text)),rule).status,'unverified',text);
 assert.equal(D.evaluateExclusions(company(prose('Number of employees: 150+')),rule).status,'clear');
});
