const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const profile=require('../profile-engine.js');
const research=require('../company-research-engine.js');
const brain=require('../company-brain.js');
const readiness=require('../step2-readiness-engine.js');
const firstParty=require('../step2-first-party-intelligence.js');
readiness.patchProfileEngine(profile);
readiness.patchResearchEngine(research,{LeadIntelCompanyBrain:brain});
firstParty.patchResearchEngine(research,{LeadIntelCompanyBrain:brain});

const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const layer=read('step2-readiness-engine.js');
const processMap=read('process-map.js');

const answers={
  priority_offers:'Sales training; AI sales coaching',
  ideal_customer:'B2B companies with established sales teams',
  lookalike_customers:'Customer A; Customer B',
  buyer_roles:'CEO; Sales Director; HR Director',
  buying_outcomes:'Improve conversion, sales execution and manager coaching',
  differentiation:'Practical sales systems combined with AI coaching',
  buying_triggers:'New Sales Director; rapid hiring; missed sales targets; market expansion',
  exclusions:'Consumer-only businesses; no active sales team',
  opportunity_value:'EUR 5,000-25,000',
  success_outcome:'Generate 30 qualified opportunities in 12 months'
};
const confirmed=Object.fromEntries(Object.keys(answers).map(id=>[id,'user']));
const evidence=[{type:'website',url:'https://example.com/',title:'Example',text:'Readable official company evidence.'}];

test('Step 2 uses the ten commercial decisions LeadIntel needs downstream',()=>{
  assert.deepEqual(readiness.QUESTION_IDS,[
    'priority_offers','ideal_customer','lookalike_customers','buyer_roles','buying_outcomes',
    'differentiation','buying_triggers','exclusions','opportunity_value','success_outcome'
  ]);
  assert.deepEqual(profile.QUESTION_IDS,readiness.QUESTION_IDS);
  assert.deepEqual(research.QUESTION_IDS,readiness.QUESTION_IDS);
  assert.match(layer,/business problem or desired outcome/i);
  assert.match(layer,/observable events/i);
  assert.match(layer,/What makes an opportunity commercially worthwhile\?/i);
  assert.match(layer,/delete state\.answers\.growth_markets/);
});

test('profile readiness counts only confirmed strategic answers and has transparent weights',()=>{
  const answerStatus={...confirmed,buying_triggers:'draft',success_outcome:'draft'};
  const summary=readiness.getReadinessSummary({website:'https://example.com/',targetMarkets:['Latvia'],answers,answerStatus,scrapedSources:evidence});
  assert.equal(summary.score,86);
  assert.equal(summary.coreConfirmed,7);
  assert.equal(summary.coreTotal,9);
  assert.equal(summary.drafts,2);
  assert.equal(summary.missing,0);
});

test('missing core inputs reduce readiness even when unaccepted AI text is visible',()=>{
  const partial={...answers,exclusions:'',opportunity_value:''};
  const answerStatus={...confirmed,buying_triggers:'draft',success_outcome:'draft',exclusions:'missing',opportunity_value:'missing'};
  const summary=readiness.getReadinessSummary({website:'https://example.com/',targetMarkets:['Latvia'],answers:partial,answerStatus,scrapedSources:evidence});
  assert.equal(summary.score,72);
  assert.equal(summary.coreConfirmed,5);
  assert.equal(summary.drafts,2);
  assert.equal(summary.missing,2);
});

test('unaccepted research drafts do not become authoritative profile facts',()=>{
  const answerStatus={...confirmed,buying_triggers:'draft',success_outcome:'draft'};
  const result=profile.buildCompanyIntelligenceProfile({website:'https://example.com/',targetMarkets:['Latvia'],answers,answerStatus,scrapedSources:evidence,documents:[]});
  assert.equal(result.buyingTriggers,'');
  assert.equal(result.commercialObjective,'');
  assert.equal(result.buyingOutcomes,answers.buying_outcomes);
  assert.ok(result.informationGaps.some(value=>/buying triggers/i.test(value)));
});

test('saved workspace state keeps answer confirmation status so browser changes cannot promote drafts',()=>{
  const normalized=profile.normalizeSavedState({website:'https://example.com/',targetMarkets:['Latvia'],answers,answerStatus:{...confirmed,buying_triggers:'draft',success_outcome:'accepted'}});
  assert.equal(normalized.answerStatus.buying_triggers,'draft');
  assert.equal(normalized.answerStatus.success_outcome,'accepted');
  assert.equal(normalized.answerStatus.priority_offers,'user');
  assert.equal(normalized.answers.buying_outcomes,answers.buying_outcomes);
  assert.equal(normalized.answers.growth_markets,undefined);
});

test('research review persists draft, accepted and user-edited states into the synced main workspace',()=>{
  assert.match(layer,/function syncAnswerStatusFromMeta/);
  assert.match(layer,/function updateAnswerStatus/);
  assert.match(layer,/accept\?"accepted":"missing"/);
  assert.match(layer,/clean\(textarea\.value\)\?"user":"missing"/);
  assert.match(layer,/answerStatus/);
});

test('readiness UI explains confirmed core inputs instead of presenting a vague completeness percentage',()=>{
  assert.match(layer,/Profile readiness/);
  assert.match(layer,/core inputs confirmed/i);
  assert.match(layer,/Build intelligence profile/);
  assert.match(layer,/draft\$\{summary\.drafts===1\?"":"s"\} to review/);
});

test('AI prompt asks for observable trigger events and customer problems instead of duplicated market segmentation',()=>{
  const prompt=research.buildAiPrompt({website:'https://example.com/',targetMarkets:['Latvia'],sources:evidence,documents:[]});
  assert.match(prompt.prompt,/buying_outcomes/i);
  assert.match(prompt.prompt,/observable/i);
  assert.doesNotMatch(prompt.prompt,/growth_markets should describe industries\/segments/i);
});

test('first-party website intelligence creates reviewable Step 2 drafts instead of blanking useful fields',()=>{
  const source={
    id:'S1',type:'website',url:'https://ccgroup.lv/',title:'Sales training and AI for business',
    text:'Advanced sales training, sales coaching, leadership development and AI tools for business. We help B2B sales teams improve sales performance, conversion, manager coaching and commercial execution.'
  };
  const draft=research.buildEvidenceDraft({sources:[source],targetMarkets:['Latvia'],uiLanguage:'en'});
  assert.match(draft.priority_offers.value,/sales training/i);
  assert.match(draft.ideal_customer.value,/B2B|sales team/i);
  assert.match(draft.buying_outcomes.value,/sales|conversion|performance|coaching/i);
  assert.equal(draft.buying_outcomes.sourceIds.includes('S1'),true);
  assert.match(draft.buying_outcomes.rationale,/first-party|inferred|website/i);
});

test('first-party inference does not invent value, exclusions or LeadIntel success targets',()=>{
  const source={id:'S1',type:'website',url:'https://ccgroup.lv/',title:'Sales training',text:'Sales training and leadership coaching for B2B sales teams.'};
  const draft=research.buildEvidenceDraft({sources:[source],targetMarkets:['Latvia'],uiLanguage:'en'});
  assert.equal(draft.opportunity_value.value,'');
  assert.equal(draft.exclusions.value,'');
  assert.equal(draft.success_outcome.value,'');
});

test('first-party inference layer is loaded before company research UI',()=>{
  const readinessPos=processMap.indexOf('step2-readiness-engine.js');
  const inferencePos=processMap.indexOf('step2-first-party-intelligence.js');
  const researchUi=processMap.indexOf('company-research-ui.js');
  assert.ok(readinessPos>=0&&inferencePos>readinessPos&&researchUi>inferencePos);
});

test('sync conflict UX de-duplicates the banner and resolves only byte-equivalent business payloads',()=>{
  assert.equal(readiness.payloadsEquivalent({a:1,b:{c:2}},{b:{c:2},a:1}),true);
  assert.equal(readiness.payloadsEquivalent({a:1},{a:2}),false);
  assert.match(layer,/function resolveEquivalentConflict/);
  assert.match(layer,/function hideDuplicateSyncStatus/);
  assert.match(layer,/querySelector\("\.autosave"\)/);
});

test('readiness layer loads after server protection but before company research review',()=>{
  const server=processMap.indexOf("server-bridge.js");
  const readinessPos=processMap.indexOf("step2-readiness-engine.js");
  const researchUi=processMap.indexOf("company-research-ui.js");
  assert.ok(server>=0&&readinessPos>server&&researchUi>readinessPos);
});

test('question-specific sufficiency distinguishes useful answers from placeholders or vague fragments',()=>{
  assert.equal(readiness.evaluateAnswer('buying_outcomes','sales').enough,false);
  assert.equal(readiness.evaluateAnswer('buying_outcomes','Improve sales conversion and help managers coach the team more effectively.').enough,true);
  assert.equal(readiness.evaluateAnswer('buyer_roles','CEO').enough,true);
  assert.equal(readiness.evaluateAnswer('buying_triggers','new office').enough,true);
  assert.equal(readiness.evaluateAnswer('success_outcome','more sales').enough,false);
});

test('confirmed but insufficient answers do not inflate profile readiness',()=>{
  const weak={...answers,buying_outcomes:'sales',success_outcome:'more sales'};
  const summary=readiness.getReadinessSummary({website:'https://example.com/',targetMarkets:['Latvia'],answers:weak,answerStatus:confirmed,scrapedSources:evidence});
  assert.equal(summary.coreConfirmed,7);
  assert.equal(summary.needsMore,2);
  assert.equal(summary.score,86);
});

test('Step 2 tells the user both whether an answer is enough and whether it has synced',()=>{
  assert.match(layer,/Enough to continue/);
  assert.match(layer,/Needs more detail/);
  assert.match(layer,/Saved to LeadIntel/);
  assert.match(layer,/Saved in this browser/);
  assert.match(layer,/Saving…/);
  assert.match(layer,/server-sync-status/);
});

test('each question exposes concise answer guidance so users know how much to write',()=>{
  for(const id of readiness.QUESTION_IDS){
    assert.ok(readiness.QUESTION_COPY[id].guidance,`${id} should explain what enough means`);
  }
  assert.match(readiness.QUESTION_COPY.buying_outcomes.guidance,/1–3|one to three|one clear sentence/i);
});
