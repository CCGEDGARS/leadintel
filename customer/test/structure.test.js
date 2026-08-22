const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
function read(name){return fs.readFileSync(path.join(__dirname,'..',name),'utf8');}

test('customer onboarding exposes main website, extra links and PDF input',()=>{
  const html=read('index.html');
  assert.match(html,/id="company-website"/);
  assert.match(html,/id="additional-links"/);
  assert.match(html,/id="pdf-input"/);
});

test('customer onboarding contains all ten strategic questions',()=>{
  const html=read('index.html');
  const ids=['priority_offers','ideal_customer','lookalike_customers','buyer_roles','growth_markets','differentiation','buying_triggers','exclusions','opportunity_value','success_outcome'];
  ids.forEach(id=>assert.match(html,new RegExp(`data-question="${id}"`)));
});

test('profile screen includes review, edit and approval controls',()=>{
  const html=read('index.html');
  assert.match(html,/id="profile-editor"/);
  assert.match(html,/id="approve-profile"/);
  assert.match(html,/id="edit-profile"/);
});