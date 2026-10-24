const test=require('node:test'),assert=require('node:assert/strict');
const T=require('../message-translations.js'),L=require('../content-language.js'),O=require('../outreach-engine.js');
test('Russian is available in both outreach selectors and survives default serialization',()=>{
 assert.equal(T.languages.ru[1],'Russian');assert.equal(L.EMAIL_LANGUAGES.ru,'Russian');
 let s=T.changeSettings({},'add','ru');s=T.changeSettings(s,'default','ru');
 assert.equal(T.settings(JSON.parse(JSON.stringify(s))).defaultLanguage,'ru');
});
test('Kazakhstan suggests Russian with confirmation; explicit Kazakh or English wins',()=>{
 for(const country of ['Kazakhstan','Казахстан','Қазақстан','Kazahstāna']){
 const r=L.resolveCampaignLanguage({country});assert.equal(r.language,'ru');assert.equal(r.requiresConfirmation,true);
 }
 assert.equal(L.resolveCampaignLanguage({domain:'buyer.kz'}).requiresConfirmation,true);
 assert.equal(L.resolveCampaignLanguage({country:'Kazakhstan',requested:'en'}).language,'en');
 assert.equal(L.resolveCampaignLanguage({country:'Kazakhstan',requested:'kk'}).language,'kk');
});
test('Russian translation retains original, CRM history and protected facts',()=>{
 const item={domain:'buyer.kz',channel:'email',drafts:{emailSubject:'Acme',emailBody:'Hello Sam.\n\n20 minutes: https://example.com/meet\n\nAlex\nAcme'},localizationProvenance:{language:'en'}};
 const draft={subject:'Acme',message:'Здравствуйте, Sam.\n\n20 минут: https://example.com/meet\n\nAlex\nAcme'};
 const valid=T.validate(T.source(item),draft,{protectedTerms:['Sam','Alex','Acme']});
 const translated=T.translated(item,'ru',valid,{editorialReview:true});
 const reopened=O.restoreCrmScriptSnapshot(O.buildCrmScriptSnapshot(translated),item.domain);
 assert.equal(T.book(reopened).activeLanguage,'ru');assert.equal(T.activate(reopened,'en').drafts.emailBody,item.drafts.emailBody);
 assert.throws(()=>T.validate(T.source(item),{...draft,message:draft.message.replace('20','30')}));
 assert.match(T.prompt(T.source(item),'ru').system,/Russian/);assert.match(T.editorialPrompt(T.source(item),draft,'ru').system,/вы/);
});
