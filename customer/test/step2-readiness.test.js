const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const profile=require('../profile-engine.js');
const research=require('../company-research-engine.js');

const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const index=read('index.html');
const app=read('app.js');
const researchUi=read('company-research-ui.js');
const bridge=read('server-bridge.js');

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
  assert.deepEqual(profile.QUESTION_IDS,[
    'priority_offers','ideal_customer','lookalike_customers','buyer_roles','buying_outcomes',
    'differentiation','buying_triggers','exclusions','opportunity_value','success_outcome'
  ]);
  assert.deepEqual(research.QUESTION_IDS,profile.QUESTION_IDS);
  assert.match(index,/data-question="buying_outcomes"/);
  assert.doesNotMatch(index,/data-question="growth_markets"/);
  assert.match(index,/business problem or desired outcome/i);
  assert.match(index,/observable events/i);
  assert.match(index,/What makes an opportunity commercially worthwhile\?/i);
});

test('profile readiness counts only confirmed strategic answers and has transparent weights',()=>{
  assert.equal(typeof profile.getReadinessSummary,'function');
  const answerStatus={...confirmed,buying_triggers:'draft',success_outcome:'draft'};
  const summary=profile.getReadinessSummary({website:'https://example.com/',targetMarkets:['Latvia'],answers,answerStatus,scrapedSources:evidence});
  assert.equal(summary.score,86);
  assert.equal(summary.coreConfirmed,7);
  assert.equal(summary.coreTotal,9);
  assert.equal(summary.drafts,2);
  assert.equal(summary.missing,0);
});

test('missing core inputs reduce readiness even when unaccepted AI text is visible',()=>{
  const partial={...answers,exclusions:'',opportunity_value:''};
  const answerStatus={...confirmed,buying_triggers:'draft',success_outcome:'draft',exclusions:'missing',opportunity_value:'missing'};
  const summary=profile.getReadinessSummary({website:'https://example.com/',targetMarkets:['Latvia'],answers:partial,answerStatus,scrapedSources:evidence});
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
});

test('research review persists draft, accepted and user-edited states into the synced main workspace',()=>{
  assert.match(researchUi,/next\.answerStatus/);
  assert.match(researchUi,/answerStatus\[id\]\s*=\s*['"]accepted['"]/);
  assert.match(researchUi,/answerStatus\[id\]\s*=\s*hasValue\s*\?\s*['"]user['"]\s*:\s*['"]missing['"]/);
  assert.match(researchUi,/syncAnswerStatusFromMeta/);
});

test('readiness UI explains confirmed core inputs instead of presenting a vague completeness percentage',()=>{
  assert.match(app,/getReadinessSummary/);
  assert.match(app,/core inputs confirmed/i);
  assert.match(index,/Profile readiness/i);
  assert.match(index,/Build intelligence profile/i);
});

test('AI prompt asks for observable trigger events and customer problems instead of duplicated market segmentation',()=>{
  const prompt=research.buildAiPrompt({website:'https://example.com/',targetMarkets:['Latvia'],sources:evidence,documents:[]});
  assert.match(prompt.prompt,/buying_outcomes/i);
  assert.match(prompt.prompt,/observable/i);
  assert.doesNotMatch(prompt.prompt,/growth_markets should describe industries\/segments/i);
});

test('sync conflict UX de-duplicates the banner and ignores dirty metadata when payloads are already identical',()=>{
  assert.match(bridge,/function payloadsEquivalent/);
  assert.match(bridge,/payloadsEquivalent\(bundle\(\),state\.payload\)/);
  assert.match(bridge,/document\.querySelector\(['"]\.autosave['"]\).*hidden\s*=\s*true/s);
});
