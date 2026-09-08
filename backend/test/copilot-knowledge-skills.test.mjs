import test from 'node:test';
import assert from 'node:assert/strict';
import {COPILOT_KNOWLEDGE_VERSION,productKnowledgeFor,technicalGuidanceFor} from '../src/copilot-knowledge.js';
import {COPILOT_SKILLS,routeCopilotSkills,skillInstructions} from '../src/copilot-skills.js';

test('product knowledge is versioned and covers all seven customer journey steps',()=>{
  assert.match(COPILOT_KNOWLEDGE_VERSION,/^\d{4}-\d{2}-\d{2}/);
  const expected=['Company & Market','Strategic Intake','Intelligence Profile','Market Strategy','Discovery','Content & Scripts','Delivery & Learning'];
  expected.forEach((label,index)=>{
    const entry=productKnowledgeFor({step:index+1});
    assert.equal(entry.step,index+1);assert.match(entry.title,new RegExp(label.replace('&','\\&'),'i'));
    assert.equal(entry.freshness,'stable');assert.ok(entry.summary.length>20);
  });
});

test('technical knowledge covers current integrations and marks changing provider facts for verification',()=>{
  for(const topic of ['openai','apollo','firecrawl','gmail']){
    const entry=technicalGuidanceFor(topic);assert.ok(entry);assert.ok(entry.summary.length>20,topic);
  }
  const current=technicalGuidanceFor('openai api key location');
  assert.equal(current.freshness,'verify');
  const future=technicalGuidanceFor('calendly zoom');
  assert.match(future.summary,/planned|future|not yet|when available/i);
  assert.equal(future.freshness,'verify');
  const serialized=JSON.stringify([current,future]);
  assert.doesNotMatch(serialized,/OAUTH_TOKEN_ENCRYPTION_KEY|APOLLO_API_KEY|SELECT .* FROM|\/api\/integrations/i);
});

test('skill registry exposes the V1 specialist capabilities without backend command surfaces',()=>{
  const ids=COPILOT_SKILLS.map(skill=>skill.id);
  for(const required of ['product_help','technical_setup','workspace_diagnostic','icp','signal_trigger','market_intelligence','lead_qualification','troubleshooting','action_safety'])assert.ok(ids.includes(required),required);
  assert.doesNotMatch(JSON.stringify(COPILOT_SKILLS),/environment variable|SQL|arbitrary command|secret retrieval/i);
});

test('skill router selects transparent specialists for product, setup, trigger and qualification questions',()=>{
  const route=(q)=>routeCopilotSkills(q,{screen:{step:4}});
  let ids=route('Where do I get my Apollo API key?');assert.ok(ids.includes('technical_setup'));assert.ok(ids.includes('troubleshooting')||ids.includes('product_help'));
  ids=route('Which triggers should I monitor?');assert.ok(ids.includes('signal_trigger'));assert.ok(ids.includes('workspace_diagnostic'));
  ids=route('Why is this company scored 62?');assert.ok(ids.includes('lead_qualification'));
  ids=route('My leads are poor quality');for(const id of ['icp','signal_trigger','lead_qualification','workspace_diagnostic'])assert.ok(ids.includes(id),id);
  ids=route('What does this button do?');assert.ok(ids.includes('product_help'));
});

test('skill instructions include only selected, known specialist instructions',()=>{
  const text=skillInstructions(['signal_trigger','workspace_diagnostic','unknown-skill']);
  assert.match(text,/signal|trigger/i);assert.match(text,/diagnos|readiness|gap/i);assert.doesNotMatch(text,/unknown-skill/);
  assert.ok(text.length<12000);
});
