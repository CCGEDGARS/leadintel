const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../outreach-engine.js');
const item={domain:'maker.se',researchAt:'2026-10-01T06:00:00Z',selectedPersonId:'p1',dossier:{domain:'maker.se',company:'Maker',people:[{id:'p1',name:'Anna Berg',title:'Operations Director'}],evidence:[{url:'https://maker.se/news/factory',title:'Factory expansion announced',text:'Maker announced a new factory.',date:'2024-03-01'}]}};
test('reviewed company trigger connects scripts to buyer and retains historical source date',()=>{
 const reviewed=E.reviewTrigger(item,item.dossier.evidence[0].url,'2026-10-01T06:01:00Z');
 const drafts=E.buildOutreachDrafts(reviewed.dossier,item.dossier.people[0],{priorityOffers:'Metal fabrication'},'brief','en');
 assert.match(drafts.emailBody,/Factory expansion announced \(2024-03-01\)/);
 assert.match(drafts.emailBody,/For your role as Operations Director/);assert.match(drafts.callOpener,/Operations Director/);assert.equal(drafts.scriptContext.buyerId,'p1');assert.equal(drafts.scriptContext.trigger.companyDomain,'maker.se');
 assert.equal(reviewed.approved,false);assert.equal(drafts.scriptContext.trigger.detectedAt,item.researchAt);
 const restored=E.restoreCrmScriptSnapshot(E.buildCrmScriptSnapshot({...reviewed,drafts}),'maker.se');
 assert.equal(restored.dossier.selectedTrigger.sourceDate,'2024-03-01');assert.equal(restored.drafts.emailBody,drafts.emailBody);
 assert.equal(restored.drafts.scriptContext.buyerRole,'Operations Director');
 assert.equal(E.restoreCrmScriptSnapshot(E.buildCrmScriptSnapshot({...reviewed,drafts}),'other.se'),null);
});
test('cross-company and changed excerpts cannot retain reviewed trigger status',()=>{
 const reviewed=E.reviewTrigger(item,item.dossier.evidence[0].url);
 assert.equal(E.normalizeSelectedTrigger(reviewed.dossier.selectedTrigger,{...reviewed.dossier,domain:'other.se'}),null);
 assert.equal(E.normalizeSelectedTrigger(reviewed.dossier.selectedTrigger,{...reviewed.dossier,evidence:[{...item.dossier.evidence[0],text:'Different announcement'}]}),null);
 assert.throws(()=>E.reviewTrigger(item,'https://other.se/news'));
});
test('undated and missing evidence never becomes a claim of recent company activity',()=>{
 const empty=E.buildOutreachDrafts({domain:'maker.se'}, {},{},'brief','en');assert.doesNotMatch(empty.emailBody,/recent public activity/);
 const undated={...item,dossier:{...item.dossier,evidence:[{...item.dossier.evidence[0],date:''}]}};
 const reviewed=E.reviewTrigger(undated,undated.dossier.evidence[0].url);
 assert.match(E.buildOutreachDrafts(reviewed.dossier,{}, {},'brief','en').emailBody,/source date unknown/);
});

test('nullable buyer and modification timestamps do not invent a buyer or publication date',()=>{
 const result=E.buildOutreachDrafts({domain:'maker.se'},null,{},'brief','en');assert.equal(result.scriptContext.buyerId,'');
 const evidence=E.normalizeDossierResearchResults({data:[{url:'https://maker.se/news',metadata:{modifiedTime:'2026-10-01'}}]},{domain:'maker.se'});assert.equal(evidence[0].date,'');
 assert.equal(E.restoreCrmScriptSnapshot({version:1,item:{domain:''}},''),null);
});
test('monitoring detection time survives save and reopen',()=>{
 const source={...item,dossier:{...item.dossier,evidence:[{...item.dossier.evidence[0],detectedAt:'2026-09-29T08:00:00Z'}]}};
 const normalized=E.normalizeOutreachState({selectedDomain:'maker.se',items:[source]}).items[0];
 assert.equal(E.reviewTrigger(normalized,source.dossier.evidence[0].url).dossier.selectedTrigger.detectedAt,'2026-09-29T08:00:00Z');
});
