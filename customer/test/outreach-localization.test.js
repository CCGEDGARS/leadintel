const test=require('node:test');
const assert=require('node:assert/strict');
const Localization=require('../outreach-localization.js');
const ContentLanguage=require('../content-language.js');

const baseDrafts={tone:'consultative',emailSubject:'NordHaus — discussion',emailBody:'Hello Anna',linkedinMessage:'Hello Anna',callOpener:'Hello Anna',followUp:'Following up.',objectionReply:'Understood.',resolvedLanguage:'de',languageSource:'market',languageConfidence:'high',languageRequiresConfirmation:false,requiresAiLocalization:true};

test('localizes a non-template campaign with the secured AI language service and keeps provenance',async()=>{
  let called=0;
  const languageService={...ContentLanguage,async localizeCampaignPackage(root,workspace,language,drafts,context){called++;assert.equal(workspace,'w1');assert.equal(language,'de');assert.equal(context.company,'NordHaus');return {drafts:{...drafts,emailBody:'Guten Tag Anna'},language:'de',provider:'anthropic',model:'claude-sonnet-4-6'};}};
  const result=await Localization.prepareCampaignDrafts({root:{},workspace:'w1',drafts:baseDrafts,scenario:{language:'auto',segment:'Furniture retailers'},candidate:{company:'NordHaus',market:'Germany',domain:'nordhaus.de'},dossier:{company:'NordHaus',market:'Germany',domain:'nordhaus.de'},languageService});
  assert.equal(called,1);
  assert.equal(result.status,'complete');
  assert.equal(result.drafts.emailBody,'Guten Tag Anna');
  assert.deepEqual(result.provenance,{provider:'anthropic',model:'claude-sonnet-4-6',language:'de',selectionSource:'market'});
});

test('uncertain automatic language blocks approval until the user confirms a language',async()=>{
  const result=await Localization.prepareCampaignDrafts({root:{},workspace:'w1',drafts:{...baseDrafts,resolvedLanguage:'en',languageSource:'fallback',languageConfidence:'low',languageRequiresConfirmation:true,requiresAiLocalization:false},scenario:{language:'auto'},candidate:{company:'Alpine',market:'Switzerland',domain:'alpine.ch'},dossier:{company:'Alpine',market:'Switzerland',domain:'alpine.ch'},languageService:ContentLanguage});
  assert.equal(result.status,'confirmation_required');
  assert.equal(result.approvalBlocked,true);
  assert.match(result.message,/confirm/i);
});

test('English and Latvian use native templates without an AI request',async()=>{
  const languageService={...ContentLanguage,async localizeCampaignPackage(){throw new Error('must not be called');}};
  const result=await Localization.prepareCampaignDrafts({root:{},workspace:'',drafts:{...baseDrafts,resolvedLanguage:'lv',requiresAiLocalization:false},scenario:{language:'lv'},candidate:{market:'Latvia'},dossier:{market:'Latvia'},languageService});
  assert.equal(result.status,'native');
  assert.equal(result.approvalBlocked,false);
  assert.equal(result.provenance.provider,'built-in');
});
