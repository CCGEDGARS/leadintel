const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Discovery=require('../discovery-engine.js'),Dossier=require('../company-dossier.js');
test('initial company dossier uses focused objectives while keeping the full people-search plan',()=>{
 const plan=Discovery.buyerResearchPlan({company:'Example Industrial',domain:'example.com',market:'Sweden',buyerRoles:['CEO','COO','Procurement Director','Engineering Director','Project Director','Plant Manager'],buyerFit:{purchase:'Conveyor engineering for a new production site'}},{priorityOffers:'Conveyor engineering',decisionMakers:'CEO; COO; Procurement Director; Engineering Director; Project Director; Plant Manager'});
 assert.ok(plan.queries.length>4);assert.equal(plan.dossierFormulas.length,4);assert.equal(Dossier.researchPlan({formulas:plan.dossierFormulas}).families.length,6);
 const objectives=plan.dossierFormulas.join(' ');for(const role of plan.roles)assert.ok(objectives.includes(role),role);assert.match(objectives,/Example Industrial/);assert.match(objectives,/Conveyor engineering/);assert.ok(plan.queries.some(q=>q.includes('linkedin.com/in/')));
});
test('focused company objectives derive from each customer and do not drop explicitly supplied formulas',()=>{
 const a=Discovery.buyerResearchPlan({company:'Example Clinic',domain:'clinic.example',buyerFit:{purchase:'Clinical staff training'}},{priorityOffers:'Clinical staff training',decisionMakers:'Medical Director'});
 const b=Discovery.buyerResearchPlan({company:'Example Factory',domain:'factory.example',buyerFit:{purchase:'Packaging equipment'}},{priorityOffers:'Packaging equipment',decisionMakers:'Production Director'});
 assert.match(a.dossierFormulas.join(' '),/Clinical staff training/);assert.doesNotMatch(b.dossierFormulas.join(' '),/Clinical staff training|Example Clinic/);
 assert.equal(Dossier.researchPlan({formulas:Array.from({length:30},(_,i)=>'Explicit objective '+i)}).families.length,32);
});
test('manual, contact refresh and automatic dossier entry use the focused plan',()=>{
 const ui=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8'),automatic=fs.readFileSync(require.resolve('../../backend/src/approved-workflow-runner.js'),'utf8');
 assert.match(ui,/formulas:plan.dossierFormulas/);assert.match(ui,/formulas:dossierPlan.dossierFormulas/);assert.match(automatic,/formulas:dossierPlan.dossierFormulas/);
});
test('active dossier retries show in progress while preserving the previous attempt',()=>{
 const UI=require('../company-dossier-ui.js'),{JSDOM}=require('jsdom'),dossier=Dossier.reconcile([],{company:'Example',domain:'example.com'});dossier.lastAttempt={status:'failed',reason:'Earlier provider deadline',checkedAt:new Date().toISOString()};
 const candidate={company:'Example',domain:'example.com',peopleStatus:'loading',buyerDiscovery:{companyDossier:dossier}},doc=new JSDOM(UI.render(candidate)).window.document;
 assert.equal(doc.querySelector('.company-dossier-status').textContent,'Company research in progress');assert.match(doc.querySelector('.company-dossier > p').textContent,/Resuming/);assert.equal(candidate.buyerDiscovery.companyDossier.lastAttempt.reason,'Earlier provider deadline');
});
