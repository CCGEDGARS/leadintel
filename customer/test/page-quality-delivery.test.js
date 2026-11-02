const {approveMessage}=require('./helpers/approved-message.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),Q=require('../page-quality.js'),Delivery=require('../delivery-engine.js');
const source=fs.readFileSync(require.resolve('../delivery-ui.js'),'utf8');
function harness(){
 const pkg=approveMessage({domain:'buyer.example',channel:'email',selectedPersonId:'sam',drafts:{emailSubject:'Subject',emailBody:'Body'},dossier:{people:[{id:'sam',name:'Sam Fixture',email:'sam@buyer.example'}]}}),record={domain:'buyer.example',recipientEmail:'sam@buyer.example'},nodes={'step-7':{},'delivery-recipient':{value:'sam@buyer.example'}};
 const context={window:{LeadIntelPageQuality:Q},LeadIntelDelivery:Delivery,LeadIntelOutreach:require('../outreach-engine.js'),q:id=>nodes[id],currentPackage:()=>pkg,currentRecord:()=>record,delivery:{selectedDomain:'buyer.example',opportunities:[record],pendingSync:[]},crmBridge:()=>({workspace:{id:'w1'},session:{user:{id:'u1'}}})};vm.createContext(context);vm.runInContext(source.slice(source.indexOf('function approvedBuyerEmail'),source.indexOf('function toast'))+source.slice(source.indexOf('function pendingManualSend'),source.indexOf('async function checkManualDelivery'))+source.slice(source.indexOf('function pendingForAccount'),source.indexOf('function renderSync')),context);
 return {pkg,record,nodes,state:context.delivery,report:()=>Q.inspect('delivery',{...context.deliveryQualityContext(),session:{ready:true,authenticated:true,workspaceId:'w1'}})};
}
test('delivery checks the exact approved text and selected buyer email without changing either',()=>{
 const h=harness();assert.equal(Q.allowed(h.report(),'send'),true);h.nodes['delivery-recipient'].value='someone@other.example';assert.equal(Q.allowed(h.report(),'send'),false);assert.equal(h.pkg.drafts.emailBody,'Body');h.nodes['delivery-recipient'].value='sam@buyer.example';h.pkg.drafts.emailBody='A later edit';assert.equal(Q.allowed(h.report(),'send'),false);assert.equal(h.pkg.drafts.emailBody,'A later edit');
});
test('stale approvals and already recorded sends cannot pass delivery readiness',()=>{
 for(const change of ['stale','sent','missing-approval']){const h=harness();if(change==='stale')h.pkg.contextNeedsRefresh=true;if(change==='sent')h.record.sentAt='2026-10-10';if(change==='missing-approval')delete h.pkg.approvedSource;assert.equal(Q.allowed(h.report(),'send'),false);}
});
test('an owned pending external send blocks duplicate delivery until CRM acknowledges it',()=>{const h=harness(),entry={workspaceId:'w1',userId:'u1',domain:'buyer.example',deferredSend:true,activity:{metadata:{delivery_record:{record:{recipientEmail:'sam@buyer.example'}}}}};h.state.pendingSync.push(entry);assert.equal(Q.allowed(h.report(),'send'),false);entry.workspaceId='another';assert.equal(Q.allowed(h.report(),'send'),true);entry.workspaceId='w1';entry.userId='another';assert.equal(Q.allowed(h.report(),'send'),true);});
