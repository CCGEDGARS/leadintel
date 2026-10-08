const {test}=require('node:test');const assert=require('node:assert/strict');const M=require('../message-studio.js');
const essentials={offer:'Inventory software',target:'retail teams',problem:'Stock spread across separate tools',value:'See stock in one place',nextAction:'Choose a suitable time here: {{calendly}}',sender:'Alex',company:'StockCo',meetingValue:'whether the workflow fits',calendly:'https://calendly.com/alex/30min'};
test('four independent saved templates survive normalization without copying another seller',()=>{const a=M.normalize({},essentials);assert.equal(a.templates.length,4);const saved=M.savePersonalTemplate(a,a.templates[0].id,'My subject','Custom {{offer}}');const b=M.normalize(JSON.parse(JSON.stringify(saved)));assert.equal(b.templates.find(t=>t.id==='template-1').body,'Custom {{offer}}');assert.notEqual(b.templates[1].body,b.templates[0].body);assert.equal(M.normalize().essentials.company,'');assert.equal(M.normalize().essentials.calendly,'');});
test('essential facts and an actual Calendly event URL gate generation',()=>{assert.deepEqual(M.missing(essentials),[]);assert.ok(M.missing({...essentials,calendly:'https://evil.test/a'}).includes('calendly'));assert.ok(M.missing({...essentials,offer:''}).includes('offer'));});
test('original mode does not inherit a template and only receives explicitly supplied facts',()=>{const s=M.normalize({mode:'original'},essentials);const p=JSON.parse(M.prompt(s,{buyerCompany:'HospitalCo'}).prompt);assert.equal(p.template,null);assert.equal(p.context.buyerCompany,'HospitalCo');assert.equal(p.essentials.company,'StockCo');});
test('generated draft rejects invented scheduling links and incomplete placeholders',()=>{const draft={subject:'Hello',message:'A 20-minute Zoom? '+essentials.calendly};assert.equal(M.parse(JSON.stringify(draft),essentials).subject,'Hello');assert.throws(()=>M.parse(JSON.stringify({...draft,message:draft.message+' https://calendly.com/other/meeting'}),essentials));assert.throws(()=>M.parse(JSON.stringify({...draft,message:'{{offer}} '+draft.message}),essentials));assert.throws(()=>M.parse('{}',essentials));});
test('core settings, templates and draft provenance survive browser and CRM snapshot reloads',()=>{const O=require('../outreach-engine.js');const studio=M.normalize({},essentials);const item={domain:'retail.example',selectedPersonId:'buyer1',channel:'email',dossier:{domain:'retail.example',people:[{id:'buyer1'}]},campaignScenario:{language:'en'},localizationStatus:'complete',messageStudioDraft:{mode:'professional',essentials,status:'Generated'},drafts:{emailSubject:'Hello',emailBody:'Saved edit'}};const state=O.normalizeOutreachState(JSON.parse(JSON.stringify({selectedDomain:item.domain,messageStudio:studio,items:[item]})));assert.deepEqual(state.messageStudio,studio);assert.equal(state.items[0].drafts.emailBody,'Saved edit');const restored=O.restoreCrmScriptSnapshot(O.buildCrmScriptSnapshot(state.items[0]),item.domain);assert.equal(restored.messageStudioDraft.essentials.company,'StockCo');assert.equal(restored.drafts.emailBody,'Saved edit');});
test('confirmed commercial answers prefill actual seller context across different industries',()=>{for(const [company,offer] of [['RetailSoft','Inventory software'],['MetalWorks','Custom metal fabrication']]){const seed=M.seed({profile:{companyName:company},answers:{priority_offers:offer,ideal_customer:'Operations teams',value_proposition:'Make project delivery simpler',proof_points:'Approved ISO certification'}},{language:'auto'},'Alex');assert.equal(seed.offer,offer);assert.equal(seed.company,company);assert.equal(seed.language,'en');assert.equal(seed.sender,'Alex');assert.equal(seed.calendly,'');}});
test('preview drafts can use an explicit missing-calendar marker but cannot invent a booking link',()=>{const e={...essentials,calendly:''};const s=M.normalize({},e);assert.equal(JSON.parse(M.prompt(s).prompt).essentials.calendly,'[Add your Calendly link]');assert.equal(M.parse(JSON.stringify({subject:'Preview',message:'A 20-minute Zoom? [Add your Calendly link]'}),e).subject,'Preview');assert.throws(()=>M.parse(JSON.stringify({subject:'Preview',message:'A 20-minute Zoom? https://calendly.com/invented/call'}),e));assert.ok(M.missing(e).includes('calendly'));});
test('seven pitch elements survive reload and produce a preview with the next action directly after meeting value',()=>{
 const studio=M.normalize({},essentials),restored=M.normalize(JSON.parse(JSON.stringify(studio)));
 assert.equal(restored.essentials.problem,essentials.problem);assert.equal(restored.essentials.nextAction,essentials.nextAction);
 const preview=M.preview(restored.essentials);assert.ok(preview.includes(essentials.problem));
 assert.ok(preview.endsWith('whether the workflow fits. Choose a suitable time here: https://calendly.com/alex/30min'));
 assert.ok(M.missing({...essentials,problem:''}).includes('problem'));assert.ok(M.missing({...essentials,nextAction:''}).includes('nextAction'));
});
test('legacy core information and customized templates are preserved while new pitch fields remain honest',()=>{
 const legacy={version:1,essentials:{offer:'Fabrication',target:'Factories',value:'One partner',proof:'ISO certificate'},templates:[{id:'professional',subject:'My subject',body:'My custom {{offer}}'}]};
 const migrated=M.normalize(legacy);assert.equal(migrated.essentials.proof,'ISO certificate');assert.equal(migrated.essentials.problem,'');assert.ok(migrated.essentials.nextAction.includes('{{calendly}}'));assert.equal(migrated.templates.find(t=>t.id==='template-1').body,'My custom {{offer}}');
});
test('seller differentiation and proof remain separate without assuming a buyer problem in either industry',()=>{
 for(const company of ['ManufacturingCo','SoftwareCo']){const seed=M.seed({profile:{companyName:company},answers:{differentiation:'One accountable partner',proof_points:'Approved case study'}});
 assert.equal(seed.proof,'Approved case study');assert.equal(seed.difference,'One accountable partner');assert.equal(seed.problem,'');assert.equal(seed.company,company);}
});
test('all default styles place a single action after meeting value and expose problem as a hypothesis',()=>{
 const s=M.normalize({},essentials);for(const t of s.templates){assert.ok(t.body.includes(t.id==='professional'?'{{roleQuestion}}':t.id==='curiosity'?'{{deliveryChallenge}}':t.id==='friendly'?'{{friendlyBenefit}}':'{{honestBenefit}}'));assert.ok(t.body.indexOf('{{nextAction}}')>t.body.lastIndexOf('{{meetingValue}}'));}
 const p=M.prompt(s);assert.match(p.system,/hypothesis/i);assert.match(p.system,/immediately after/i);
});

test('restored booking placeholders use only the active workspace valid event link',()=>{
 const text='Hi Sam, 20-minute Zoom? [Add your Calendly link]';
 assert.equal(M.resolveBookingPlaceholder(text,'https://calendly.com/legal/advice'),'Hi Sam, 20-minute Zoom? https://calendly.com/legal/advice');
 for(const url of ['', 'https://calendly.com/', 'https://evil.example/meeting', 'javascript:alert(1)'])assert.equal(M.resolveBookingPlaceholder(text,url),text);
 const existing='Use https://calendly.com/another/meeting';assert.equal(M.resolveBookingPlaceholder(existing,'https://calendly.com/sender/meeting'),existing);
});

test('four styles have separate five-subject collections with a common sender-company default',()=>{
 const groups=['professional','curiosity','friendly','brutal'].map(style=>M.subjectsFor(style));
 for(const group of groups){assert.equal(group.length,5);assert.equal(group[0].id,'sender');assert.equal(group[0].pattern,'{{sender}}. {{company}}');assert.ok(group.every(x=>x.id!=='introduction'));}
 assert.equal(new Set(groups.map(g=>g[1].pattern)).size,4);
 assert.equal(M.originalText('professional','email').includes('Hi Joakim,'),true);
 const base=M.normalize({},essentials);
 for(const style of ['professional','curiosity','friendly','brutal']){
   const selected=M.normalize({...base,mode:style},essentials);
   assert.equal(selected.subjectChoices[style],'sender');
   assert.equal(M.resolveApprovedSubject(selected,{buyerCompany:'LKAB'},essentials),'Alex. StockCo');
 }
 assert.equal(M.resolveApprovedSubject(M.chooseSubject({...base,mode:'curiosity'},'curiosity','role'),{},essentials),'Are you in charge?');
 assert.equal(M.resolveApprovedSubject(M.chooseSubject({...base,mode:'friendly'},'friendly','together'),{},essentials),'What could we build together?');
 assert.equal(M.resolveApprovedSubject(M.chooseSubject({...base,mode:'professional'},'professional','project'),{buyerCompany:'LKAB'},essentials),'A practical idea for LKAB');
 assert.equal(M.resolveApprovedSubject(M.chooseSubject({...base,mode:'professional'},'professional','project'),{buyerCompany:'LKAB',trigger:{title:'Malmberget',verification:'source_verified'}},essentials),'Regarding Malmberget');
});

test('generated email rejects unfilled sender and booking reference placeholders',()=>{
 const e={...essentials};
 for(const placeholder of ['(First name Second name)','[Calendly link]','[reference link]']){
  const message='Hi Jordan, '+placeholder+' Would you consider a 20-minute Zoom? '+e.calendly;
  assert.throws(()=>M.parse(JSON.stringify({subject:'Alex. StockCo',message}),e),/unfilled sender|unfilled fields/i);
 }
});

test('personal styles preserve protected originals, activate independently and survive workspace reload',()=>{
 const base=M.normalize({},essentials);
 const custom=M.savePersonalStyle(base,'professional',{subject:'{{sender}}. {{company}}',body:'Hi {{firstName}},\n\nOur 20-minute Zoom meeting: {{calendly}}'});
 assert.equal(custom.personalStyles.professional.active,true);
 assert.equal(custom.personalStyles.professional.revision,1);
 assert.match(M.prompt(custom,{buyerCompany:'RetailCo'}).prompt,/activePersonalStyle/);
 assert.match(M.prompt(custom,{buyerCompany:'RetailCo'}).prompt,/Our 20-minute Zoom/);
 assert.match(M.originalText('professional'),/Hi Joakim/);
 const disabled=M.activatePersonalStyle(custom,'professional',false);
 assert.equal(disabled.personalStyles.professional.active,false);
 const stored=M.storageState(custom);
 assert.equal(M.normalize(JSON.parse(JSON.stringify(stored))).personalStyles.professional.body,custom.personalStyles.professional.body);
 const revised=M.savePersonalStyle(custom,'professional',{subject:'A different subject',body:'Hi {{firstName}}, revised structure.'});
 assert.equal(revised.personalStyles.professional.revision,2);
 assert.equal(M.restorePersonalStyle(revised,'professional').personalStyles.professional.revision,1);
});
test('AI length choices only apply to AI Generated',()=>{
 const ai=M.normalize({mode:'original',aiLength:'short'},essentials);
 assert.equal(JSON.parse(M.prompt(ai,{buyerCompany:'RetailCo'}).prompt).aiLength,'short');
 const mandatory=M.normalize({...ai,mode:'friendly'},essentials);
 assert.equal(JSON.parse(M.prompt(mandatory,{buyerCompany:'RetailCo'}).prompt).aiLength,null);
});
