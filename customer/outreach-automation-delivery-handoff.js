(function(root){
'use strict';
const OUTREACH_KEY='leadintel_customer_v2_outreach';
const DELIVERY_KEY='leadintel_customer_v2_delivery';
function read(key){try{const value=JSON.parse(localStorage.getItem(key)||'{}');return value&&typeof value==='object'?value:{};}catch{return {};}}
function approvedPackage(){
  const outreach=read(OUTREACH_KEY),delivery=read(DELIVERY_KEY);const items=Array.isArray(outreach.items)?outreach.items:[];const selected=String(delivery.selectedDomain||'');
  return items.find(item=>item&&item.approved&&String(item.domain||'')===selected)||null;
}
function recipient(){return String(document.getElementById('delivery-recipient')?.value||'').trim().toLowerCase();}
function buildApprovedAutomationPackage(pkg,recipientValue){
  if(!pkg?.approved)return null;const source=pkg.approvedSource&&typeof pkg.approvedSource==='object'?pkg.approvedSource:(pkg.drafts&&typeof pkg.drafts==='object'?pkg.drafts:{});
  return {domain:String(pkg.domain||''),recipient:String(recipientValue||'').trim().toLowerCase(),subject:String(source.emailSubject||''),body:String(source.emailBody||''),followup_body:String(source.followUp||''),approved_at:String(pkg.approvedAt||''),contact_identity:String(pkg.selectedPersonId||pkg.domain||''),approved:true};
}
function announceApprovedAutomationPackage(){
  const detail=buildApprovedAutomationPackage(approvedPackage(),recipient());if(!detail)return false;
  root.dispatchEvent(new CustomEvent('leadintel:approved-outreach-package',{detail}));return true;
}
function relevant(target){return target?.id==='delivery-recipient'||target?.id==='delivery-company-select';}
function init(){
  document.addEventListener('input',event=>{if(relevant(event.target))announceApprovedAutomationPackage();});
  document.addEventListener('change',event=>{if(relevant(event.target))setTimeout(announceApprovedAutomationPackage,0);});
  root.addEventListener?.('leadintel:module-opened',event=>{if(Number(event.detail?.step)===7)setTimeout(announceApprovedAutomationPackage,0);});
  setTimeout(announceApprovedAutomationPackage,0);
}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();}
root.LeadIntelOutreachAutomationDeliveryHandoff={announceApprovedAutomationPackage,buildApprovedAutomationPackage};
if(typeof module!=='undefined'&&module.exports)module.exports=root.LeadIntelOutreachAutomationDeliveryHandoff;
})(typeof window!=='undefined'?window:globalThis);
