const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { CALENDLY_URL, normalizeIndex, stages } = require('../../demo/demo.js');

const root = path.join(__dirname, '../..');
const demoHtml = fs.readFileSync(path.join(root, 'demo/index.html'), 'utf8');
const demoCss = fs.readFileSync(path.join(root, 'demo/demo.css'), 'utf8');
const appHtml = fs.readFileSync(path.join(root, 'customer/index.html'), 'utf8');

test('guided tour follows the seven stages in the customer workspace', () => {
  const appStages = [...appHtml.matchAll(/<li(?=[^>]*data-workflow-stage="\d+")[^>]*>[\s\S]*?<strong>(.*?)<\/strong>/g)]
    .map(([, title]) => title.replaceAll('&amp;', '&'));

  assert.equal(stages.length, 7);
  assert.deepEqual(stages.map(stage => stage.title), ['Setup', 'Profile', 'Strategy', 'Companies', 'Buyers', 'Messages', 'Delivery']);
  assert.deepEqual(stages.map(stage => stage.title), appStages);
  for (const stage of stages) {
    assert.ok(stage.what.trim(), `${stage.title} explains what it is`);
    assert.ok(stage.why.trim(), `${stage.title} explains why it matters`);
    assert.ok(stage.action.trim(), `${stage.title} explains what to do`);
    assert.ok(stage.next.trim(), `${stage.title} explains what happens next`);
  }
});

test('lookalike guidance describes customer references as a soft preference', () => {
  assert.match(stages[3].what, /analyze existing customer websites/i);
  assert.match(stages[3].action, /review the inferred group or groups/i);
  assert.match(stages[3].action, /one-company profile is marked low confidence/i);
  assert.match(stages[3].next, /guide Companies search and ranking/i);
  assert.match(stages[3].next, /soft preference/i);
  assert.match(demoHtml, /soft preference/i);
  assert.match(demoHtml, /does not exclude other companies/i);
  assert.match(demoHtml, /reference customers are not added to outreach/i);
});

test('workspace preview stays inert and the only active link is the strategy booking', () => {
  assert.match(demoHtml, /id="workspace-preview"[^>]*aria-hidden="true" inert/);
  const activeLinks = [...demoHtml.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(([, href]) => href);
  assert.deepEqual(activeLinks, [CALENDLY_URL]);
});

test('tour stage index is always bounded to one of the seven stages', () => {
  assert.equal(normalizeIndex(-1), 0);
  assert.equal(normalizeIndex(6), 6);
  assert.equal(normalizeIndex(99), 6);
  assert.equal(normalizeIndex(Number.NaN), 0);
  assert.equal(normalizeIndex(2.9), 2);
});

test('demo route uses the LeadIntel design palette and adapts for narrow screens', () => {
  assert.match(demoCss, /--bg:#f7f8f4/);
  assert.match(demoCss, /--green-dark:#123f36/);
  assert.match(demoCss, /filter:blur\(6px\)/);
  assert.match(demoCss, /@media\(max-width:760px\)/);
  assert.match(demoCss, /prefers-reduced-motion:reduce/);
});
