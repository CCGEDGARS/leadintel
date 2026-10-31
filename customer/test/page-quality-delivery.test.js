const {approveMessage}=require('./helpers/approved-message.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),Q=require('../page-quality.js'),Delivery=require('../delivery-engine.js');
const source=fs.readFileSync(require.resolve('../delivery-ui.js'),'utf8');
function harness(){
 const pkg=approveMessage({domain:'buyer.example',channel:'email',selectedPersonId:'sam',drafts:{emailSubject:'Subject',emailBody:'Body'},dossier:{people:[{id:'sam',name:'Sam Fixture',email:'sam@buyer.example'}]}}),record={domain:'buyer.example',recipientEmail:'sam@buyer.example'},nodes={'step-7':{},'delivery-recipient':{value:'sam@buyer.example'}};
 const context={window:{LeadIntelPageQuality:Q},LeadIntelDelivery:Delivery,LeadIntelOutreach:require('../outreach-engine.js'),q:id=>nodes[id],currentPackage:()=>pkg,currentRecord:()=>record,delivery:{selectedDomain:'buyer.example',opportunities:[record]},crmBridge:()=>({workspace:{id:'w1'}})};vm.createContext(context);vm.runInContext(source.slice(source.indexOf('function approvedBuyerEmail'),source.indexOf('function toast')),context);
 return {pkg,record,nodes,report:()=>Q.inspect('delivery',{...context.deliveryQualityContext(),session:{ready:true,authenticated:true,workspaceId:'w1'}})};
}
test('delivery checks the exact approved text and selected buyer email without changing either',()=>{
 const h=harness();assert.equal(Q.allowed(h.report(),'send'),true);h.nodes['delivery-recipient'].value='someone@other.example';assert.equal(Q.allowed(h.report(),'send'),false);assert.equal(h.pkg.drafts.emailBody,'Body');h.nodes['delivery-recipient'].value='sam@buyer.example';h.pkg.drafts.emailBody='A later edit';assert.equal(Q.allowed(h.report(),'send'),false);assert.equal(h.pkg.drafts.emailBody,'A later edit');
});
test('stale approvals and already recorded sends cannot pass delivery readiness',()=>{
 for(const change of ['stale','sent','missing-approval']){const h=harness();if(change==='stale')h.pkg.contextNeedsRefresh=true;if(change==='sent')h.record.sentAt='2026-10-10';if(change==='missing-approval')delete h.pkg.approvedSource;assert.equal(Q.allowed(h.report(),'send'),false);}
});
