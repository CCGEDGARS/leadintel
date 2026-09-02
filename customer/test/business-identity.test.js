const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const profile = require('../profile-engine.js');
const step2 = require('../step2-readiness-engine.js');
step2.patchProfileEngine(profile, null);

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
  const app = fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
  assert.match(app,/Business identity/i);
  assert.match(app,/Commercial positioning/i);
  assert.match(app,/Sales message/i);
  assert.match(app,/Business summary/i);
  assert.match(app,/USP \/ value proposition/i);
  assert.match(app,/Elevator pitch/i);
});
