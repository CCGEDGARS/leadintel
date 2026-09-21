const test=require('node:test');
const assert=require('node:assert/strict');
const Outreach=require('../outreach-engine.js');

const profile={
  companyName:'SellerCo',
  priorityOffers:'industrial automation; engineering services',
  idealCustomer:'manufacturers with 50–500 employees',
  decisionMakers:'COO; Procurement Director',
  targetMarkets:'Sweden; Finland',
  differentiation:'fast engineering and custom delivery',
  buyingTriggers:'new facility; modernization',
  commercialObjective:'Build a qualified export pipeline'
};

test('normalizing an empty Campaign Studio creates the mandatory core scenario from the approved profile',()=>{
  const studio=Outreach.normalizeCampaignStudio({},profile,'en');
  assert.equal(studio.coreScenario.segment,'manufacturers with 50–500 employees');
  assert.equal(studio.coreScenario.offer,'industrial automation');
  assert.equal(studio.coreScenario.buyerRole,'COO');
  assert.equal(studio.coreScenario.trigger,'new facility');
  assert.match(studio.coreScenario.summary,/manufacturers with 50–500 employees/i);
  assert.match(studio.coreScenario.summary,/industrial automation/i);
  assert.equal(studio.coreScenario.status,'draft');
});

test('accepted core scenario is retained and becomes needs-review after material profile changes',()=>{
  const initial=Outreach.normalizeCampaignStudio({},profile,'en');
  const accepted=Outreach.saveCoreScenario(initial,{...initial.coreScenario,status:'approved',summary:'Our approved scenario.'},'2026-09-16T10:00:00.000Z');
  const unchanged=Outreach.normalizeCampaignStudio(accepted,profile,'en');
  assert.equal(unchanged.coreScenario.status,'approved');
  assert.equal(unchanged.coreScenario.summary,'Our approved scenario.');
  const changed=Outreach.normalizeCampaignStudio(accepted,{...profile,priorityOffers:'robotic welding'},'en');
  assert.equal(changed.coreScenario.status,'needs_review');
  assert.equal(changed.coreScenario.summary,'Our approved scenario.');
  const reapproved=Outreach.saveCoreScenario(changed,{...changed.coreScenario,status:'approved'},'2026-09-16T11:00:00.000Z',{...profile,priorityOffers:'robotic welding'});
  assert.equal(Outreach.normalizeCampaignStudio(reapproved,{...profile,priorityOffers:'robotic welding'},'en').coreScenario.status,'approved');
});

test('saving the core scenario rejects an empty mandatory scenario',()=>{
  const studio=Outreach.normalizeCampaignStudio({},profile,'en');
  assert.throws(()=>Outreach.saveCoreScenario(studio,{...studio.coreScenario,summary:'   '}),/scenario is required/i);
});

test('core scenario fields are replaceable and optional values can be cleared',()=>{
  const studio=Outreach.normalizeCampaignStudio({},profile,'en');
  const saved=Outreach.saveCoreScenario(studio,{...studio.coreScenario,summary:'A replacement scenario.',segment:'public-sector buyers',offer:'advisory',buyerRole:'Legal Counsel',trigger:'',valueProposition:'lower response time',objective:'Book qualified meetings',cta:'Review one live case',tone:'brief',language:'lv',status:'approved'});
  assert.equal(saved.coreScenario.segment,'public-sector buyers');
  assert.equal(saved.coreScenario.trigger,'');
  assert.equal(saved.coreScenario.valueProposition,'lower response time');
  assert.equal(saved.coreScenario.objective,'Book qualified meetings');
  assert.equal(saved.coreScenario.tone,'brief');
  assert.equal(saved.coreScenario.language,'lv');
});

test('segment presets require a segment and inherit the core scenario defaults',()=>{
  const generated=Outreach.normalizeCampaignStudio({},profile,'en');
  const studio=Outreach.saveCoreScenario(generated,{...generated.coreScenario,status:'approved'},'2026-09-16T10:00:00.000Z');
  assert.throws(()=>Outreach.saveCampaignPreset(studio,{segment:' '}),/segment is required/i);
  const saved=Outreach.saveCampaignPreset(studio,{segment:'German furniture retailers',tone:'direct'},'2026-09-16T10:05:00.000Z');
  assert.equal(saved.coreScenario.status,'approved');
  assert.equal(saved.presets.length,1);
  assert.equal(saved.presets[0].segment,'German furniture retailers');
  assert.equal(saved.presets[0].offer,'industrial automation');
  assert.equal(saved.presets[0].buyerRole,'COO');
  assert.equal(saved.presets[0].tone,'direct');
  const regenerated=Outreach.regenerateCoreScenario(saved,{...profile,priorityOffers:'robotic welding'},'en');
  assert.equal(regenerated.coreScenario.offer,'robotic welding');
  assert.equal(regenerated.presets.length,1);
  assert.equal(regenerated.selectedPresetId,saved.selectedPresetId);
});

test('non-Latin campaign segments receive distinct stable preset IDs',()=>{
  let studio=Outreach.normalizeCampaignStudio({},profile,'en');
  studio=Outreach.saveCampaignPreset(studio,{segment:'製造業'});
  studio=Outreach.saveCampaignPreset(studio,{segment:'小売業'});
  assert.equal(studio.presets.length,2);
  assert.notEqual(studio.presets[0].id,studio.presets[1].id);
});

test('the saved scenario language controls scripts and is inherited by presets',()=>{
  let studio=Outreach.normalizeCampaignStudio({},profile,'en');
  studio=Outreach.saveCoreScenario(studio,{...studio.coreScenario,summary:'Latvian campaign',language:'lv',status:'approved'});
  studio=Outreach.saveCampaignPreset(studio,{segment:'Furniture retailers'});
  assert.equal(studio.presets[0].language,'lv');
  const dossier={company:'NordHaus',recommendedOffer:'industrial automation',matchedSignals:[{name:'modernization'}]};
  const drafts=Outreach.buildOutreachDrafts(dossier,{},profile,'consultative','en',studio.presets[0]);
  assert.match(drafts.emailBody,/Labdien|Izpētot/);
  assert.doesNotMatch(drafts.emailBody,/Hello|I came across/);
});

test('legacy automatic language settings migrate to English and manual localization remains available',()=>{
  const legacy=Outreach.normalizeCampaignScenario({segment:'retailers',offer:'consulting',tone:'consultative',language:'auto'});
  assert.equal(legacy.language,'en');
  const scenario={...legacy,language:'de'};
  const drafts=Outreach.buildOutreachDrafts({company:'NordHaus',domain:'nordhaus.de',market:'Germany',recommendedOffer:'consulting'}, {},profile,'consultative','en',scenario);
  assert.equal(drafts.resolvedLanguage,'de');
  assert.equal(drafts.requiresAiLocalization,true);
  assert.match(drafts.emailBody,/Hello|I came across/);
  const approved=Outreach.approveOutreachItem({drafts,campaignScenario:{...scenario,resolvedLanguage:'de',languageSource:'manual'},localizationStatus:'complete',localizationProvenance:{provider:'anthropic',model:'claude-sonnet-4-6',language:'de',selectionSource:'manual'}},drafts,'2026-09-16T12:00:00.000Z');
  assert.equal(approved.campaignSnapshot.language,'de');
  assert.equal(approved.campaignSnapshot.resolvedLanguage,'de');
  assert.equal(approved.campaignSnapshot.languageSource,'manual');
});

test('workspace persistence retains localization status and AI provenance',()=>{
  const state=Outreach.normalizeOutreachState({selectedDomain:'nordhaus.de',items:[{domain:'nordhaus.de',drafts:{emailSubject:'Hallo',emailBody:'Text',linkedinMessage:'Text'},localizationStatus:'complete',localizationApprovalBlocked:false,localizationMessage:'Localized',localizationProvenance:{provider:'anthropic',model:'claude-sonnet-4-6',language:'de',selectionSource:'market'}}]});
  assert.equal(state.items[0].localizationStatus,'complete');
  assert.equal(state.items[0].localizationApprovalBlocked,false);
  assert.equal(state.items[0].localizationProvenance.provider,'anthropic');
  assert.equal(state.items[0].localizationProvenance.language,'de');
});

test('legacy and failed localization records cannot bypass campaign approval',()=>{
  const drafts={emailSubject:'Subject',emailBody:'Body',linkedinMessage:'Message'};
  const legacy=Outreach.normalizeOutreachState({items:[{domain:'example.com',dossier:{company:'Example'},drafts}]}).items[0];
  assert.equal(legacy.localizationApprovalBlocked,true);
  assert.equal(legacy.localizationStatus,'confirmation_required');
  assert.equal(Outreach.approveOutreachItem(legacy,drafts).approved,false);
  const failed={...legacy,localizationStatus:'error',localizationApprovalBlocked:true,error:''};
  const rejected=Outreach.approveOutreachItem(failed,drafts);
  assert.equal(rejected.approved,false);
  assert.match(rejected.error,/language|localization/i);
});

test('approval requires a resolved campaign language and complete provider provenance',()=>{
  const drafts={emailSubject:'Betreff',emailBody:'Text',linkedinMessage:'Text'};
  const scenario={id:'campaign-de',summary:'German campaign',language:'auto',resolvedLanguage:'de',languageSource:'market'};
  const missing=Outreach.approveOutreachItem({drafts,campaignScenario:scenario,localizationStatus:'complete',localizationProvenance:{language:'de',selectionSource:'market'}},drafts);
  assert.equal(missing.approved,false);
  assert.match(missing.error,/provider|provenance/i);
});

test('approval freezes the resolved language and AI localization provenance',()=>{
  const drafts={tone:'consultative',emailSubject:'Betreff',emailBody:'Guten Tag',linkedinMessage:'Guten Tag',callOpener:'Guten Tag',followUp:'Nachfrage',objectionReply:'Verstanden'};
  const provenance={provider:'anthropic',model:'claude-sonnet-4-6',language:'de',selectionSource:'market'};
  const approved=Outreach.approveOutreachItem({domain:'nordhaus.de',drafts,campaignScenario:{language:'auto',resolvedLanguage:'de',languageSource:'market'},localizationStatus:'complete',localizationProvenance:provenance},drafts,'2026-09-16T12:30:00.000Z');
  assert.deepEqual(approved.localizationSnapshot,provenance);
  provenance.language='fr';
  assert.equal(approved.localizationSnapshot.language,'de');
  const restored=Outreach.normalizeOutreachState({items:[approved]}).items[0];
  assert.equal(restored.localizationSnapshot.model,'claude-sonnet-4-6');
});

test('campaign context influences generated scripts and is snapshotted on approval',()=>{
  const scenario={
    id:'campaign-1',segment:'German furniture retailers',offer:'custom manufacturing',buyerRole:'Owner',
    trigger:'new showroom',valueProposition:'short custom production runs',cta:'Compare partnership options in a 15-minute call',tone:'consultative',language:'en'
  };
  const dossier={company:'NordHaus',recommendedOffer:'industrial automation',buyerRoles:['COO'],whyNow:'Public evidence mentions a new showroom.',matchedSignals:[{name:'new showroom'}]};
  const drafts=Outreach.buildOutreachDrafts(dossier,{firstName:'Anna'},profile,'consultative','en',scenario);
  assert.match(drafts.emailBody,/custom manufacturing/i);
  assert.match(drafts.emailBody,/German furniture retailers/i);
  assert.match(drafts.emailBody,/15-minute call/i);
  assert.doesNotMatch(drafts.emailBody,/This campaign is for|Suggested next step/i);
  const approved=Outreach.approveOutreachItem({domain:'nordhaus.example',dossier,drafts,localizationStatus:'native',localizationProvenance:{provider:'built-in',model:'LeadIntel native templates',language:'en',selectionSource:'manual'}},drafts,'2026-09-16T10:10:00.000Z',{campaignScenario:scenario});
  assert.equal(approved.approved,true);
  assert.equal(approved.campaignSnapshot.segment,'German furniture retailers');
  scenario.segment='Changed later';
  assert.equal(approved.campaignSnapshot.segment,'German furniture retailers');
});

test('Campaign Studio UI replaces Content and Scripts and exposes scenario and segment controls',()=>{
  const fs=require('node:fs');
  const ui=fs.readFileSync(require.resolve('../outreach-ui.js'),'utf8');
  assert.match(ui,/Campaign Studio/);
  assert.match(ui,/core-scenario-summary/);
  assert.match(ui,/core-scenario-offer/);
  assert.match(ui,/core-scenario-segment/);
  assert.match(ui,/core-scenario-buyer-role/);
  assert.match(ui,/core-scenario-trigger/);
  assert.match(ui,/core-scenario-value/);
  assert.match(ui,/core-scenario-objective/);
  assert.match(ui,/core-scenario-cta/);
  assert.match(ui,/core-scenario-tone/);
  assert.match(ui,/core-scenario-language/);
  assert.match(ui,/outreach-email-language/);
  assert.match(ui,/confirmOutreachLanguage/);
  assert.match(ui,/campaign-segment/);
  assert.match(ui,/save-core-scenario/);
  assert.match(ui,/save-campaign-preset/);
  assert.doesNotMatch(ui,/<strong>Content & Scripts<\/strong>/);
});
