const test=require('node:test');
const assert=require('node:assert/strict');
const CrmPresentation=require('../crm-presentation.js');

test('CRM intelligence detail shows score factors and classified evidence links',()=>{
  const html=CrmPresentation.intelligenceHtml({
    opportunity_hypothesis:'Acme is expanding its commercial team.',
    matched_signals:[{name:'Sales hiring'}],
    confidence:'High',
    score_breakdown:{fit:24,signal:20,evidence:16,timing:10,value:8,total:78},
    evidence:[
      {url:'https://www.linkedin.com/company/acme',title:'Acme is hiring',description:'The company announced a new sales team.'},
      {url:'https://industry.example/news/acme-expansion',title:'Acme opens a new office',description:'A public industry-news mention.'}
    ]
  });
  assert.match(html,/24\s*\/\s*30/);
  assert.match(html,/20\s*\/\s*25/);
  assert.match(html,/Public LinkedIn-indexed page/);
  assert.match(html,/Public web page/);
  assert.match(html,/Acme is hiring/);
  assert.match(html,/Acme opens a new office/);
  assert.match(html,/Acme is expanding its commercial team/);
});

test('CRM evidence rendering escapes content and never links non-http or credentialed URLs',()=>{
  const html=CrmPresentation.evidenceHtml([
    {url:'javascript:alert(1)',title:'<img src=x onerror=alert(1)>',description:'Unsafe scheme.'},
    {url:'https://user:pass@research.example/path',title:'Credentialed URL',description:'Should not be linked.'}
  ]);
  assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html,/<img src=x/);
  assert.doesNotMatch(html,/href="javascript:/);
  assert.doesNotMatch(html,/href="https:\/\/user:pass@/);
  assert.match(html,/Source URL unavailable/);
});

test('CRM contact detail shows email status and Apollo LinkedIn identity provenance safely',()=>{
  const html=CrmPresentation.contactsHtml([
    {name:'Anna Andersson',title:'Sales Director',work_email:'anna@example.com',email_status:'verified',source:'apollo',linkedin_url:'https://www.linkedin.com/in/anna-andersson'},
    {name:'Unsafe',source:'apollo',linkedin_url:'javascript:alert(1)'},
    {name:'Wrong host',source:'apollo',linkedin_url:'https://evil.example/profile'}
  ]);
  assert.match(html,/Email status · verified/);
  assert.match(html,/Contact source · Apollo/);
  assert.match(html,/Apollo-provided identity link/);
  assert.match(html,/confirm the current role before outreach/i);
  assert.match(html,/anna@example\.com/);
  assert.doesNotMatch(html,/href="javascript:/);
  assert.doesNotMatch(html,/href="https:\/\/evil\.example/);
});
