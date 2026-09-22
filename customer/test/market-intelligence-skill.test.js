const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'../..');
const skillPath=path.join(root,'.agents/skills/leadintel-market-intelligence/SKILL.md');

test('LeadIntel market intelligence skill exists and governs research orchestration',()=>{
  assert.equal(fs.existsSync(skillPath),true,'missing LeadIntel market intelligence skill');
  const text=fs.readFileSync(skillPath,'utf8');
  for(const required of [
    'adaptive follow-up',
    'source diversification',
    'evidence triangulation',
    'recency',
    'commercial fit',
    'OpenAI',
    'Gemini',
    'Firecrawl',
    'Scrapling',
    'Apollo',
    'LinkedIn',
    'Quick Overview',
    'Market Research',
    'Deep Analysis'
  ]) assert.match(text,new RegExp(required,'i'),`skill must cover ${required}`);
});

test('repository operating rules require the market intelligence skill for research work',()=>{
  const agents=fs.readFileSync(path.join(root,'AGENTS.md'),'utf8');
  assert.match(agents,/leadintel-market-intelligence\/SKILL\.md/);
  assert.match(agents,/market research|market intelligence/i);
});
