(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.LeadIntelProfileApprovalUI=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  function updateProfileApprovalUI(document,approved){
    const status=document.getElementById("profile-status");
    if(status){status.textContent=approved?"Approved":"Provisional";status.classList.toggle("approved",approved);}
    const approveButton=document.getElementById("approve-profile");
    const continueButton=document.getElementById("continue-market-strategy");
    if(approveButton){approveButton.innerHTML=approved?'Approved <span aria-hidden="true">✓</span>':'Approve profile';approveButton.disabled=approved;approveButton.setAttribute("aria-disabled",approved?"true":"false");}
    if(continueButton){continueButton.innerHTML='Continue to Market Strategy <span aria-hidden="true">→</span>';continueButton.disabled=!approved;continueButton.setAttribute("aria-disabled",approved?"false":"true");}
    const approvalCard=document.getElementById("approval-card");
    if(!approvalCard)return;
    approvalCard.classList.toggle("approved",approved);
    const approvalTitle=approvalCard.querySelector("h3"),approvalCopy=approvalCard.querySelector("p"),approvalEyebrow=approvalCard.querySelector(".eyebrow");
    if(approvalEyebrow)approvalEyebrow.textContent=approved?"Profile approved":"Profile approval";
    if(approvalTitle)approvalTitle.textContent=approved?"Your approved profile is ready for Market Strategy.":"Approve this profile before building Market Strategy.";
    if(approvalCopy)approvalCopy.textContent=approved?"LeadIntel will use this reviewed version to generate ICPs, buying signals and market opportunities.":"Review the interpretation above. Approval saves it as the current source of truth.";
  }
  return {updateProfileApprovalUI};
});
