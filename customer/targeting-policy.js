(function(root,factory){const api=factory();if(typeof module!=="undefined"&&module.exports)module.exports=api;if(root)root.LeadIntelTargeting=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const fields={priority_offers:"priorityOffers",ideal_customer:"idealCustomer",buyer_roles:"decisionMakers",exclusions:"exclusions"};
  const clean=value=>String(value??"").replace(/\s+/g," ").trim();
  function missing(state={}){return Object.keys(fields).filter(id=>!clean(state.answers?.[id])||/^(unknown|tbd|todo|to be confirmed|not sure|[-?]+)$/i.test(clean(state.answers?.[id])));}
  function signature(state={}){return JSON.stringify([1,clean(state.website).toLowerCase().replace(/\/$/,""),(state.targetMarkets||[]).map(clean).sort(),...Object.keys(fields).map(id=>clean(state.answers?.[id]))]);}
  function isConfirmed(state={}){return !missing(state).length&&state.targetingConfirmation?.version===1&&state.targetingConfirmation.signature===signature(state);}
  function profileFields(state={}){return Object.fromEntries(Object.entries(fields).map(([id,key])=>[key,clean(state.answers?.[id])]));}
  function confirm(state={},now=new Date().toISOString()){if(missing(state).length)return null;return {version:1,signature:signature(state),confirmedAt:now};}
  function focusControl(root,options={}){
    root.LeadIntelCustomerNavigation?.setStep?.(options.step||2);
    const focus=()=>{
      const doc=root.document;if(!doc)return;
      const target=options.id?doc.getElementById(options.id):doc.querySelector(options.selector);
      if(!target)return;
      doc.getElementById('required-action-notice')?.remove();
      const notice=doc.createElement('div');notice.id='required-action-notice';notice.className='required-action-notice';notice.setAttribute('role','alert');notice.textContent=options.message||'Complete this required step before continuing.';target.parentNode?.insertBefore(notice,target);
      target.classList?.add('required-action-focus');target.scrollIntoView?.({behavior:'smooth',block:'center'});target.focus?.({preventScroll:true});
    };
    if(root.requestAnimationFrame)root.requestAnimationFrame(focus);else focus();
    return false;
  }
  function focusRequired(root,state={}){
    const absent=missing(state);
    return focusControl(root,{step:2,id:absent.length?'':'confirm-targeting',selector:absent.length?`[data-question="${absent[0]}"]`:'',message:absent.length?'Complete this required targeting answer, then confirm targeting before continuing.':'Your answers are saved. Click Confirm targeting below before continuing.'});
  }
  return {fields,missing,signature,isConfirmed,profileFields,confirm,focusControl,focusRequired};
});
