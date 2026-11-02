const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js'),C=require('../company-dossier.js');
test('saved official staff repair an empty shortlist and a completed-selection hold without new provider work',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),page=require('./fixtures/viscaria-public-buyer-pages.json').pages[0],main={profile:{decisionMakers:'Head of Procurement'}},candidate={company:'Viscaria',domain:'viscaria.com',buyerSearchMode:'user_selected_target',buyerRoles:'Head of Procurement',buyerRolesChanged:true,people:[]};
 candidate.buyerDiscovery={opportunityRoles:['Head of Procurement'],roleSelectionContext:D.buyerRoleSelectionContext(main),checkedAt:new Date().toISOString(),companyContacts:D.discoverCompanyContacts([{...page,sourceRead:true}],candidate)};
 const ctx={LeadIntelDiscovery:D,mainState:()=>main,localStorage:{getItem:()=>JSON.stringify({selectedProspects:[candidate]})},DISCOVERY_STORAGE_KEY:'d',recoveredInterruptedRun:false},source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function loadDiscovery('),source.indexOf('function saveDiscovery(')),ctx);
 const restored=ctx.loadDiscovery().selectedProspects[0];assert.ok(restored.people.some(p=>p.name==='Robert Åkerlind'));assert.equal(restored.buyerRolesChanged,false);assert.equal(D.acceptedOfficialBuyerEmail(restored,restored.people.find(p=>p.name==='Robert Åkerlind')),'robert.akerlind@viscaria.com');
});
test('a brief excludes navigation and preserves initials inside a complete statement',()=>{
 const B=require('../research-brief.js'),candidate={company:'Example',domain:'example.com',evidence:[{url:'https://example.com/project',text:'Read more about the project development and the road ahead.',sourceRead:true,verification:'source_verified',extractedAt:new Date().toISOString()}]};assert.equal(B.build(candidate).facts.length,0);
 candidate.evidence[0].text='Together with Petter A. Lind, Example is building a new plant.';const brief=B.build(candidate);assert.ok(brief.facts.every(f=>f.text!=='Together with Petter A.'));assert.ok(brief.facts.some(f=>f.text.includes('Petter A. Lind')));
});
test('held named contacts remain visible while unresolved first names stay out of buyer cards',()=>{
 const candidate={company:'Example',domain:'example.com',buyerRolesChanged:true},person={id:'r',name:'Alex Lind',publicName:'Alex Lind',organization:'Example',title:'Head of Procurement',publicNameUrl:'https://example.com/team'};
 const people=D.retainBuyerIdentities([{id:'pending',name:'Alex',identityStatus:'pending',title:'Head of Procurement'},person],{decisionMakers:'Procurement Director'},candidate);
 assert.deepEqual(people.map(p=>p.name),['Alex Lind']);assert.equal(D.qualifyBuyer(people[0],{decisionMakers:'Procurement Director'},candidate).eligible,false);
});
test('structured and legacy object errors produce useful messages',()=>{
 for(const value of [{error:{code:'RATE_LIMIT',message:'Research provider rate limit'}},{message:{detail:'Research provider rate limit'}},{reason:'Research provider rate limit'}])assert.equal(C.errorMessage(value),'Research provider rate limit');
 assert.equal(C.errorMessage('[object Object]','Company research failed'),'Company research failed');
 const d=C.reconcile([],{company:'Example',domain:'example.com'});d.lastAttempt={status:'failed',reason:{error:{message:'Research provider rate limit'}},checkedAt:new Date().toISOString()};assert.equal(C.safe(d,'example.com').lastAttempt.reason,'Research provider rate limit');
});
test('equivalent role wording is not an employment conflict, but distinct duties and statuses stay held',()=>{
 const pass=(provider,title,status='current')=>({provider,status:'complete',webSearch:true,people:[{name:'Alex Lind',title,status,sourceUrl:'https://example.com/team',quote:'Alex Lind is '+title}],facts:[],channels:[],sources:['https://example.com/team']});
 for(const titles of [['CEO','Chief Executive Officer'],['COO','Chief Operating Officer'],['Head of Procurement','Procurement Director']])assert.equal(C.reconcile([pass('openai',titles[0]),pass('gemini',titles[1])],{company:'Example',domain:'example.com'}).conflicts.length,0);
 const previous=C.reconcile([pass('openai','CEO'),pass('gemini','Chief Executive Officer')],{company:'Example',domain:'example.com'});previous.conflicts=[{name:'Alex Lind',reason:'Different role or employment status in source-backed research',titles:['CEO','Chief Executive Officer'],sources:['https://example.com/team']}];assert.equal(C.safe(previous,'example.com').conflicts.length,0,'a persisted wording-only conflict is repaired from the retained validated passes');
 assert.equal(C.reconcile([pass('openai','Chief Executive Officer'),pass('gemini','Chief Operating Officer')],{company:'Example',domain:'example.com'}).conflicts.length,1);
 assert.equal(C.reconcile([pass('openai','CEO'),pass('gemini','Chief Executive Officer','departed')],{company:'Example',domain:'example.com'}).conflicts.length,1);
});
