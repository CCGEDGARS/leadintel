const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const profile = require('../profile-engine.js');
const step2 = require('../step2-readiness-engine.js');
step2.patchProfileEngine(profile, null);
const identity = require('../business-identity.js');
const research = require('../company-research-engine.js');
identity.patchProfileEngine(profile, null);

const answers = {
  priority_offers:'Corporate sales training; leadership coaching; practical AI sales solutions',
  ideal_customer:'B2B companies with established sales teams, sales managers and commercial leaders',
  lookalike_customers:'Apple; Microsoft; Toyota',
  buyer_roles:'CEO; Sales Director; HR Director',
  buying_outcomes:'Improve sales conversion, strengthen sales leadership and build more predictable commercial performance',
  differentiation:'combining practical sales experience with sales psychology, NLP, coaching and applied AI tools',
  buying_triggers:'new sales leader; missed targets; market expansion; rapid sales hiring',
  exclusions:'private consumers and companies without an active B2B sales function',
  opportunity_value:'€5,000–€25,000 typical engagement',
  success_outcome:'30 qualified opportunities and €500,000 pipeline within 12 months'
};
const answerStatus = Object.fromEntries(Object.keys(answers).map(key=>[key,'user']));
const input = {
  uiLanguage:'en',
  website:'https://ccgroup.lv/',
  targetMarkets:['Latvia'],
  answers,
  answerStatus,
  documents:[],
  scrapedSources:[{
    type:'website',
    url:'https://ccgroup.lv/',
    title:'Coaching & Consulting Group',
    text:'Over the years, I have developed unique training programs. Coaching & Consulting Group provides corporate sales training, leadership coaching and practical AI solutions for commercial teams. The company works with B2B organisations and sales leaders across Europe.'
  }]
};

test('Step 3 generates distinct business summary, USP and elevator pitch from confirmed commercial context', () => {
  const result = profile.buildCompanyIntelligenceProfile(input);
  assert.ok(result.businessSummary);
  assert.ok(result.uniqueSellingProposition);
  assert.ok(result.elevatorPitch);
  assert.ok(result.positioningConfidence);
  assert.ok(result.uspStatus);
  assert.match(result.businessSummary,/Coaching & Consulting Group/i);
  assert.match(result.businessSummary,/B2B companies|sales teams/i);
  assert.match(result.uniqueSellingProposition,/sales psychology|NLP|applied AI/i);
  assert.match(result.elevatorPitch,/we help/i);
  assert.doesNotMatch(result.businessSummary,/\bI\b|\bmy\b|https?:\/\/|\.png/i);
  assert.ok(result.businessSummary.split(/\s+/).length <= 130);
  assert.ok(result.elevatorPitch.split(/\s+/).length <= 90);
});

test('USP becomes proposed when differentiation is not confirmed and does not smuggle an unaccepted draft into positioning', () => {
  const draftInput = JSON.parse(JSON.stringify(input));
  draftInput.answerStatus.differentiation='draft';
  const result = profile.buildCompanyIntelligenceProfile(draftInput);
  assert.match(result.uspStatus,/proposed|confirmation/i);
  assert.doesNotMatch(result.uniqueSellingProposition,/sales psychology|NLP|applied AI/i);
});

test('saved profiles missing the new business identity fields are upgraded without overwriting existing clean identity edits', () => {
  const built = profile.buildCompanyIntelligenceProfile(input);
  const migrated = profile.normalizeSavedState({...input,profile:{...built,businessSummary:'',uniqueSellingProposition:'',elevatorPitch:''}});
  assert.ok(migrated.profile.businessSummary);
  assert.ok(migrated.profile.uniqueSellingProposition);
  assert.ok(migrated.profile.elevatorPitch);

  const edited='CCGROUP helps commercial teams improve sales performance through tailored training, coaching and applied AI.';
  const preserved = profile.normalizeSavedState({...input,profile:{...built,businessSummary:edited}});
  assert.equal(preserved.profile.businessSummary,edited);
});

test('Step 3 UI separates Business Identity, Commercial Positioning and Sales Message', () => {
  const ui = fs.readFileSync(path.join(__dirname,'..','business-identity.js'),'utf8');
  const processMap = fs.readFileSync(path.join(__dirname,'..','process-map.js'),'utf8');
  assert.match(processMap,/business-identity\.js/);
  assert.match(ui,/Business identity/i);
  assert.match(ui,/Commercial positioning/i);
  assert.match(ui,/Sales message/i);
  assert.match(ui,/Business summary/i);
  assert.match(ui,/USP \/ value proposition/i);
  assert.match(ui,/Elevator pitch/i);
});

test('Competitive Advantages spans the complete Commercial Positioning grid', () => {
  const ui = fs.readFileSync(path.join(__dirname,'..','business-identity.js'),'utf8');
  const processMap = fs.readFileSync(path.join(__dirname,'..','process-map.js'),'utf8');
  const shell = fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  assert.match(ui,/diff\.classList\.add\("wide","identity-wide"\)/);
  assert.match(processMap,/business-identity\.js\?v=20260906-pain-headings-v1/);
  assert.match(shell,/process-map\.js\?v=20260924-friendly-workflow-labels-v1/);
});


test('Step 3 removes scraped navigation labels and repairs contaminated saved identity fields', () => {
  const contaminated = JSON.parse(JSON.stringify(input));
  contaminated.answers.priority_offers = 'UZZINĀT VAIRĀK Noliktavu optimizācija – mēs palīdzēsim aprīkot noliktavu un ražotni UZZINĀT VAIRĀK Realizētie projekti – iedvesma tavai darba videi UZZINĀT VAIRĀK Uzņēmumi, kas izvēlas mūsu risinājumus';
  contaminated.answerStatus.priority_offers = 'user';
  const generated = profile.buildCompanyIntelligenceProfile(contaminated);
  assert.doesNotMatch(generated.businessSummary, /UZZINĀT VAIRĀK|LEARN MORE/i);
  assert.doesNotMatch(generated.uniqueSellingProposition, /UZZINĀT VAIRĀK|LEARN MORE/i);

  const built = profile.buildCompanyIntelligenceProfile(input);
  const saved = profile.normalizeSavedState({...input, profile:{...built,
    priorityOffers: contaminated.answers.priority_offers,
    businessSummary: contaminated.answers.priority_offers,
    uniqueSellingProposition: contaminated.answers.priority_offers,
    elevatorPitch: contaminated.answers.priority_offers
  }});
  assert.doesNotMatch(saved.profile.businessSummary, /UZZINĀT VAIRĀK|LEARN MORE/i);
  assert.doesNotMatch(saved.profile.uniqueSellingProposition, /UZZINĀT VAIRĀK|LEARN MORE/i);
  assert.doesNotMatch(saved.profile.elevatorPitch, /UZZINĀT VAIRĀK|LEARN MORE/i);
  assert.equal(saved.profile.priorityOffers, '');
});


test('Business Identity patches profile normalization before app state is loaded', () => {
  const app = fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
  const identityImport = app.indexOf('business-identity.js');
  const stateLoad = app.indexOf('let state=loadState();');
  assert.ok(identityImport >= 0, 'app must load Business Identity before state initialization');
  assert.ok(identityImport < stateLoad, 'Business Identity import must precede loadState');
});


test('repairs scraped card headings that remain concatenated after CTA removal', () => {
  const built = profile.buildCompanyIntelligenceProfile(input);
  const contaminatedOverview = 'Noliktavu optimizācija – mēs palīdzēsim aprīkot noliktavu un ražotni Realizētie projekti – iedvesma tavai darba videi Uzņēmumi, kas izvēlas mūsu risinājumus Instrumentu skapis SUPPLY Izturīgs metāla skapis efektīvai instrumentu un detaļu uzglabāšanai.';
  const migrated = profile.normalizeSavedState({...input, profile:{...built, companyOverview:contaminatedOverview, businessSummary:contaminatedOverview}});
  assert.doesNotMatch(migrated.profile.businessSummary, /Realizētie projekti|Uzņēmumi, kas izvēlas mūsu risinājumus/i);
  assert.match(migrated.profile.businessSummary, /corporate sales training/i, 'confirmed offer must take precedence over an unrelated scraped product card');
});


test('Step 3 exposes analytical diagnostics and commercial frameworks', () => {
  const result = profile.buildCompanyIntelligenceProfile(input);
  assert.ok(result.analysis);
  assert.ok(result.analysis.scores);
  assert.ok(Number.isInteger(result.analysis.scores.commercialClarity));
  assert.ok(result.analysis.scores.commercialClarity >= 0 && result.analysis.scores.commercialClarity <= 100);
  assert.ok(result.analysis.frameworks);
  assert.ok(result.analysis.frameworks.goldenCircle);
  assert.ok(result.analysis.frameworks.valueProposition);
  assert.ok(result.analysis.frameworks.fab);
  assert.ok(result.analysis.positioningStatement);
  assert.match(result.analysis.status, /proposed|confirmed/i);
});


test('Step 1 opens the questionnaire immediately and keeps evidence-first research optional', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const researchUi = fs.readFileSync(path.join(__dirname, '..', 'company-research-ui.js'), 'utf8');
  const researchEngine = fs.readFileSync(path.join(__dirname, '..', 'company-research-engine.js'), 'utf8');
  assert.match(index, /company-research-ui\.js/);
  assert.match(researchUi, /runCompanyResearch/);
  assert.match(researchUi, /Continue to Profile/);
  assert.match(researchUi, /rerun-company-research/);
  assert.doesNotMatch(researchUi, /function interceptStepOne/);
  assert.match(researchUi, /Evidence draft/);
  assert.match(researchEngine, /buildEvidenceDraft/);
  assert.match(researchEngine, /mergeDraft/);
});


test('Business Identity keeps language handling internal while the workspace stays English-only', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.doesNotMatch(index, /language-select/);

  const lvInput = JSON.parse(JSON.stringify(input));
  lvInput.uiLanguage = 'lv';
  lvInput.answers.priority_offers = 'Biroja mēbeles, ergonomiski krēsli, regulējami galdi, noliktavu un darbnīcu aprīkojums, 3D vizualizācijas';
  lvInput.answers.ideal_customer = 'Biroji, ražotnes, noliktavas, darbnīcas un izglītības iestādes';
  lvInput.answers.buying_outcomes = '';
  lvInput.scrapedSources = [{type:'website', url:'https://example.lv', text:'Piedāvājam biroja mēbeles, ergonomiskus krēslus, noliktavu aprīkojumu un darba vietu plānošanu ar 3D vizualizācijām.'}];
  const result = profile.buildCompanyIntelligenceProfile(lvInput);
  assert.equal(result.analysis.language, 'lv');
  assert.match(result.analysis.frameworks.fab.benefits, /ergonom|sakārtot|vizualizēt/i);
  assert.doesNotMatch(result.elevatorPitch, /We help|through|Our approach/i);
});


test('Latvian default produces complete evidence-backed framework conclusions', () => {
  const lvInput = JSON.parse(JSON.stringify(input));
  lvInput.uiLanguage = 'lv';
  lvInput.answers.priority_offers = 'Biroja mēbeles, ergonomiski krēsli, regulējami galdi, noliktavu un darbnīcu aprīkojums, 3D vizualizācijas';
  lvInput.answers.ideal_customer = 'Biroji, ražotnes, noliktavas, darbnīcas un izglītības iestādes';
  lvInput.answers.buying_outcomes = '';
  lvInput.answers.differentiation = '';
  lvInput.scrapedSources = [{type:'website',url:'https://example.lv',text:'Piedāvājam biroja mēbeles, ergonomiskus krēslus, noliktavu aprīkojumu un darba vietu plānošanu ar 3D vizualizācijām.'}];
  const result = profile.buildCompanyIntelligenceProfile(lvInput);
  assert.equal(result.analysis.language, 'lv');
  assert.doesNotMatch(result.analysis.frameworks.goldenCircle.why, /Jāprecizē klienta rezultāts/i);
  assert.doesNotMatch(result.analysis.frameworks.fab.advantages, /nav apstiprināta/i);
  assert.match(result.analysis.frameworks.fab.advantages, /plāno|ergonom|vizualiz|efektīv/i);
  assert.match(result.analysis.frameworks.fab.benefits, /ergonom|sakārtot|vizualizēt/i);
  assert.doesNotMatch(result.elevatorPitch, /We help|through|Our approach/i);
});

test('AJ Produkti identity starts the Latvian business summary with the company name', () => {
  const ajInput = JSON.parse(JSON.stringify(input));
  ajInput.website = 'https://www.ajprodukti.lv/';
  ajInput.uiLanguage = 'lv';
  ajInput.answers.priority_offers = 'Biroja mēbeles un darba vides aprīkojums';
  ajInput.answers.ideal_customer = 'Latvijas uzņēmumi, biroji, noliktavas un darbnīcas';
  ajInput.answers.buying_outcomes = 'ergonomiskāka un efektīvāka darba vide';
  ajInput.scrapedSources = [{
    type: 'website',
    url: 'https://www.ajprodukti.lv/',
    title: 'Biroja mēbeles un darba vides aprīkojums',
    text: 'AJ Produkti piedāvā biroja mēbeles un darba vides aprīkojumu Latvijas uzņēmumiem.'
  }];
  const result = profile.buildCompanyIntelligenceProfile(ajInput);
  assert.equal(result.companyName, 'AJ Produkti');
  assert.match(result.businessSummary, /^AJ Produkti\s/);
  assert.doesNotMatch(result.businessSummary, /^Biroja mēbeles/i);
});

test('existing AJ Produkti saved profiles repair a category mistaken for the company name', () => {
  const ajInput = JSON.parse(JSON.stringify(input));
  ajInput.website = 'https://www.ajprodukti.lv/';
  ajInput.uiLanguage = 'lv';
  ajInput.answers.priority_offers = 'Biroja mēbeles un darba vides aprīkojums';
  ajInput.scrapedSources = [{type:'website',url:'https://www.ajprodukti.lv/',title:'Biroja mēbeles un darba vides aprīkojums',text:'AJ Produkti piedāvā biroja mēbeles un darba vides aprīkojumu.'}];
  const saved = profile.normalizeSavedState({...ajInput, profile:{companyName:'Biroja mēbeles un darba vides aprīkojums', priorityOffers:ajInput.answers.priority_offers, businessSummary:'Biroja mēbeles un darba vides aprīkojums nodrošina biroja mēbeles.'}});
  assert.equal(saved.profile.companyName, 'AJ Produkti');
  assert.match(saved.profile.businessSummary, /^AJ Produkti\s/);
});

test('Research synthesis prompt requires fully Latvian ready-to-use output', () => {
  const prompt = research.buildAiPrompt({website:'https://example.lv',targetMarkets:['Latvia'],uiLanguage:'lv',sources:[],documents:[]});
  assert.match(prompt.prompt, /Latvian|latviešu/i);
  assert.match(prompt.prompt, /same language|one language|ready-to-use/i);
});

test('Commercial Context generates full-width Customer Pain Points with three commercial value angles', () => {
  const ajInput = JSON.parse(JSON.stringify(input));
  ajInput.website = 'https://www.ajprodukti.lv/';
  ajInput.uiLanguage = 'lv';
  ajInput.answers.priority_offers = 'Ergonomiski biroja krēsli un augstumā regulējami galdi; noliktavu plaukti un instrumentu skapji; darba vietu plānošana ar 3D vizualizācijām';
  ajInput.answers.ideal_customer = 'Latvijas uzņēmumi ar birojiem, noliktavām un darbnīcām';
  ajInput.scrapedSources = [{type:'website',url:'https://www.ajprodukti.lv/',title:'AJ Produkti',text:'AJ Produkti piedāvā ergonomiskas biroja mēbeles, noliktavu aprīkojumu un darba vietu plānošanu ar 3D vizualizācijām.'}];
  const result = profile.buildCompanyIntelligenceProfile(ajInput);
  assert.match(result.customerPainPoints,/neergonom|nogurum|diskomfort/i);
  assert.match(result.customerPainPoints,/Kā var palīdzēt nopelnīt vairāk:/);
  assert.match(result.customerPainPoints,/Kā var palīdzēt samazināt izmaksas:/);
  assert.match(result.customerPainPoints,/Kā var palīdzēt vienkāršot darbu:/);
  assert.doesNotMatch(result.customerPainPoints,/How it can|guarantee|guaranteed/i);
  assert.equal(result.customerPainPointsStatus,'AI-inferred · review recommended');
});

test('Customer Pain Points follows English content language without mixing Latvian', () => {
  const enInput = JSON.parse(JSON.stringify(input));
  enInput.uiLanguage = 'en';
  enInput.answers.priority_offers = 'Ergonomic office furniture; warehouse storage; 3D workplace planning';
  const result = profile.buildCompanyIntelligenceProfile(enInput);
  assert.match(result.customerPainPoints,/How it can help earn more:/);
  assert.match(result.customerPainPoints,/How it can help reduce costs:/);
  assert.match(result.customerPainPoints,/How it can make work easier:/);
  assert.doesNotMatch(result.customerPainPoints,/Kā var palīdzēt|izmaksas|vienkāršot/i);
});

test('Customer Pain Points renders the three commercial angle headings as highlighted bold text', () => {
  const html = identity.renderCustomerPainPoints([
    'Acīmredzamā problēma.',
    'Kā var palīdzēt nopelnīt vairāk: lielāka darba efektivitāte.',
    'Kā var palīdzēt samazināt izmaksas: mazāk kļūdainu pirkumu.',
    'Kā var palīdzēt vienkāršot darbu: ērtāka ieviešana.'
  ].join('\n\n'));
  assert.match(html,/<strong class="pain-angle-heading">Kā var palīdzēt nopelnīt vairāk<\/strong>:/);
  assert.match(html,/<strong class="pain-angle-heading">Kā var palīdzēt samazināt izmaksas<\/strong>:/);
  assert.match(html,/<strong class="pain-angle-heading">Kā var palīdzēt vienkāršot darbu<\/strong>:/);
  assert.match(html,/class="pain-angle-highlight"/);
  assert.doesNotMatch(identity.renderCustomerPainPoints('<script>alert(1)<\/script>'),/<script>/);
});

test('saved profiles receive Customer Pain Points without overwriting a customer edit', () => {
  const built = profile.buildCompanyIntelligenceProfile(input);
  const migrated = profile.normalizeSavedState({...input,profile:{...built,customerPainPoints:''}});
  assert.ok(migrated.profile.customerPainPoints);
  const edited = 'Customer-confirmed pain: fragmented purchasing creates avoidable administration.';
  const preserved = profile.normalizeSavedState({...input,profile:{...built,customerPainPoints:edited,customerPainPointsStatus:'Customer-confirmed'}});
  assert.equal(preserved.profile.customerPainPoints,edited);
  assert.equal(preserved.profile.customerPainPointsStatus,'Customer-confirmed');
});

test('Customer Pain Points is positioned after the ideal customer and spans the Commercial Context grid', () => {
  const ui = fs.readFileSync(path.join(__dirname,'..','business-identity.js'),'utf8');
  const app = fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
  assert.match(app,/\["customerPainPoints","Customer Pain Points",true\]/);
  assert.match(ui,/"priorityOffers","idealCustomer","customerPainPoints","buyingOutcomes"/);
  assert.match(ui,/identity-customerPainPoints/);
});
