const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const language=require('../content-language.js');
const businessIdentity=fs.readFileSync(path.join(root,'business-identity.js'),'utf8');
const companyResearch=fs.readFileSync(path.join(root,'company-research-ui.js'),'utf8');
const contentLanguage=fs.readFileSync(path.join(root,'content-language.js'),'utf8');

test('workspace profile and research never expose translation attempts or retry controls',()=>{
  assert.equal(language.translateEditor,undefined);
  assert.doesNotMatch(businessIdentity,/translateEditor|content-language-status|Retry translation|Translation unavailable/i);
  assert.doesNotMatch(companyResearch,/translateEditor|content-language-status|Retry translation|Translation unavailable/i);
  assert.doesNotMatch(contentLanguage,/content-language-status|Retry translation|Translation unavailable/i);
});

test('translation remains available only as an explicit Campaign Studio localization action',()=>{
  assert.equal(typeof language.localizeCampaignPackage,'function');
  assert.equal(typeof language.resolveCampaignLanguage,'function');
});
