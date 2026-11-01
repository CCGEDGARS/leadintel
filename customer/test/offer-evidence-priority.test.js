const test=require('node:test'),assert=require('node:assert/strict');
const B=require('../research-brief'),O=require('../outreach-engine');
const now='2026-11-01T12:00:00Z',fact=(quote,extra={})=>({quote,text:quote,url:'https://buyer.example/news',kind:'development',verification:'source_verified',...extra});
test('offer relevance outranks generic hiring without inferring budget or demand',()=>{
 const profile={priorityOffers:'steel fabrication installation'},hiring=fact('We are hiring a marketing director.',{date:'2026-10-31'}),relevant=fact('Our steel fabrication facility is expanding.',{date:'2026-10-01'});
 const a=B.signalPriority(relevant,profile,null,now),b=B.signalPriority(hiring,profile,null,now);
 assert.ok(a.score>b.score);assert.deepEqual(a.offerTerms,['steel','fabrication']);assert.doesNotMatch(a.reason,/needs|budget|buying intent|overloaded|guarantee/i);
});
test('priority follows active offers across industries and is invariant to seller or buyer names',()=>{
 for(const offer of ['steel fabrication','clinical diagnostics','cloud migration']){
  const quote='Our '+offer+' facility is expanding.',a=B.signalPriority(fact(quote),{companyName:'Alpha',priorityOffers:offer},null,now),b=B.signalPriority(fact(quote),{companyName:'Beta',priorityOffers:offer},null,now);
  assert.deepEqual(a,b);assert.ok(a.offerTerms.length===2);assert.equal(a.freshness,'unknown');assert.match(a.reason,/not evidence of urgency/);
 }
 assert.equal(B.signalPriority(fact('We are hiring a marketing director.'),{priorityOffers:'steel'},null,now).offerTerms.length,0);
});
test('source dates, qualifiers and verification control priority without erasing historical facts',()=>{
 for(const quote of ['We are not expanding our steel facility.','If we build a new steel plant, work may start.','Our steel factory project has been cancelled.','Unconfirmed reports describe a new steel facility.'])assert.equal(B.signalPriority(fact(quote),{priorityOffers:'steel'},null,now).usable,false);
 for(const [date,freshness] of [['2023-01-01','stale'],['2099-01-01','future']]){const p=B.signalPriority(fact('Our steel plant is expanding.',{date}),{priorityOffers:'steel'},null,now);assert.equal(p.usable,false);assert.equal(p.freshness,freshness);}
 assert.equal(B.signalPriority(fact('Our steel facility is expanding.',{verification:'public_unverified'}),{},null,now).usable,false);
 assert.equal(B.signalPriority(fact('Our steel facility is expanding.',{date:'2026-02-31'}),{},null,now).freshness,'unknown');
});
test('actual brief ranks extracted offer evidence, persists provenance, and preserves manual text through CRM reopen',()=>{
 const evidence=(text,path,date)=>({url:'https://buyer.example/'+path,text,sourceRead:true,date,extractedAt:now}),profile={companyName:'Seller',priorityOffers:'steel fabrication'},candidate={company:'Buyer',domain:'buyer.example',evidence:[evidence('We are hiring a marketing director.','jobs','2026-10-31'),evidence('Our steel fabrication plant is expanding.','plant','2026-10-01'),evidence('Our steel fabrication plant is expanding.','history','2023-01-01')]};
 const before=JSON.stringify(candidate),brief=B.build(candidate,profile);assert.equal(brief.facts[0].url,'https://buyer.example/plant');assert.equal(brief.signalSelection.url,brief.facts[0].url);assert.match(brief.signalSelection.reason,/steel, fabrication/);assert.equal(brief.facts.length,3);assert.equal(JSON.stringify(candidate),before);
 const item={domain:candidate.domain,company:candidate.company,channel:'email',dossier:O.buildOpportunityDossier(candidate,profile),drafts:{emailSubject:'Manual subject',emailBody:'Keep exactly this approved working text.'}},snapshot=O.buildCrmScriptSnapshot(item),reopened=O.restoreCrmScriptSnapshot(JSON.parse(JSON.stringify(snapshot)),candidate.domain);
 assert.equal(reopened.drafts.emailBody,item.drafts.emailBody);assert.equal(reopened.drafts.emailSubject,item.drafts.emailSubject);assert.deepEqual(reopened.dossier.researchBrief.signalSelection,item.dossier.researchBrief.signalSelection);assert.ok(reopened.dossier.researchBrief.facts.some(row=>row.date==='2023-01-01'));
 const other=B.build({...candidate,domain:'other.example'},profile);assert.equal(other.signalSelection,null);assert.equal(other.facts.length,0);
});
test('snippets and model summaries cannot enter the signal selection',()=>{
 for(const evidenceKind of ['search_snippet','model_summary']){const brief=B.build({domain:'buyer.example',evidence:[{url:'https://buyer.example/news',text:'Our steel plant is expanding.',sourceRead:true,evidenceKind}]},{priorityOffers:'steel'});assert.equal(brief.signalSelection,null);}
});

test('calendar May is not modal uncertainty, while may expand remains conditional',()=>{
 for(const date of ['in May 2026','on May 12, 2026','on 12 May 2026'])assert.equal(B.signalPriority(fact('Our steel fabrication facility launched '+date+'.',{date:'2026-05-01'}),{},null,now).usable,true,date);
 assert.equal(B.signalPriority(fact('Our steel fabrication facility may expand in 2027.'),{},null,now).usable,false);
});
test('actual message trigger selection follows offer priority, blocks stale snippets, and preserves reviewed/saved text',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(require.resolve('../outreach-ui.js'),'utf8'),F=require('../message-facts');
 let item={domain:'buyer.example',company:'Buyer',channel:'email',approved:false,drafts:{emailBody:'Exact saved manual text'},dossier:{domain:'buyer.example',company:'Buyer',selectedTrigger:null,evidence:[
  {url:'https://buyer.example/a',text:'Buyer is constructing a new marketing office in Riverport.',sourceRead:true,date:'2026-10-30'},
  {url:'https://buyer.example/b',text:'Buyer has expanded its steel fabrication facility in Northport.',sourceRead:true,date:'2026-10-01'},
  {url:'https://buyer.example/old',text:'Buyer has expanded its steel fabrication factory in Westport.',sourceRead:true,date:'2023-01-01'},
  {url:'https://buyer.example/snippet',text:'Buyer is constructing a new steel fabrication facility in Eastport.',evidenceKind:'search_snippet',date:'2026-10-31'}]}};
 const ctx={URL,LeadIntelResearchBrief:B,LeadIntelOutreach:O,LeadIntelMessageFacts:F,LeadIntelMessageEditor:{prepareFactContext:()=>({factPreparation:{facts:[],opening:'verified-summary',openingFact:{quote:'under construction'}}})},messageFactCandidates:()=>F.candidates(item.dossier.evidence,{domain:item.domain,company:item.company}),studioState:()=>({essentials:{offer:'steel fabrication'}}),selectedContact:()=>({title:'Operations Director'}),selectedCandidate:()=>({domain:item.domain}),studioMessageContext:()=>({researchBrief:B.build({domain:item.domain,company:item.company,evidence:item.dossier.evidence},{priorityOffers:'steel fabrication'})}),currentItem:()=>item,upsertItem:v=>{item=v;}};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function rankedBuyingTriggers'),source.indexOf('function prepareMessageOnOpen')),ctx);
 assert.equal(ctx.automaticallySelectBuyingTrigger(),true);assert.equal(item.dossier.selectedTrigger.url,'https://buyer.example/b');assert.equal(item.dossier.selectedTrigger.sourceDate,'2026-10-01');assert.equal(item.drafts.emailBody,'Exact saved manual text');
 item.dossier.selectedTrigger={...item.dossier.selectedTrigger,verification:'user_reviewed',url:'https://buyer.example/a'};assert.equal(ctx.automaticallySelectBuyingTrigger({refresh:true}),false);assert.equal(item.dossier.selectedTrigger.url,'https://buyer.example/a');
 item.dossier.selectedTrigger=null;item.approved=true;assert.equal(ctx.automaticallySelectBuyingTrigger({refresh:true}),false);
});
