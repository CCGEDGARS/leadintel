(function(root){
  "use strict";

  function looksLikeUrlOrDomain(value){
    const text=String(value??"").trim();
    if(!text||/\s/.test(text))return false;
    return /^https?:\/\//i.test(text)||/^www\./i.test(text)||/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+\/?$/i.test(text);
  }

  function clearUrlLikeValue(input){
    if(!input||!looksLikeUrlOrDomain(input.value))return false;
    input.value="";
    return true;
  }

  function hardenInputSemantics(input){
    if(!input)return false;
    input.setAttribute("type","search");
    input.setAttribute("name","leadintel-market-definition");
    input.setAttribute("autocomplete","off");
    input.setAttribute("inputmode","text");
    input.setAttribute("autocapitalize","words");
    input.setAttribute("data-form-type","other");
    input.setAttribute("data-lpignore","true");
    input.setAttribute("data-1p-ignore","true");
    return true;
  }

  function showMisplacedWebsiteMessage(){
    const toast=root.document?.getElementById?.("toast");
    if(!toast)return;
    toast.textContent="That looks like a website. Use the Main company website field above.";
    toast.classList.add("show");
    root.clearTimeout?.(showMisplacedWebsiteMessage.t);
    showMisplacedWebsiteMessage.t=root.setTimeout?.(()=>toast.classList.remove("show"),3200);
  }

  function install(){
    if(!root?.document||root.__leadintelCustomMarketInputHygieneInstalled)return;
    const input=root.document.getElementById("custom-target-market");
    if(!input)return;
    root.__leadintelCustomMarketInputHygieneInstalled=true;
    hardenInputSemantics(input);

    // Browsers may ignore autocomplete="off" and visually restore a prior URL into
    // generic text fields. This field is a market-definition/search field, never a
    // website field, so keep its semantics explicit and reject URL/domain values.
    const sweep=()=>{
      const current=root.document.getElementById("custom-target-market");
      hardenInputSemantics(current);
      return clearUrlLikeValue(current);
    };
    input.addEventListener("input",sweep,true);
    input.addEventListener("focus",sweep,true);
    root.addEventListener?.("pageshow",sweep);
    root.document.addEventListener("visibilitychange",sweep,true);

    // Final safety gate runs before app.js' normal + Add market handler. Even if a
    // browser paints/restores a URL late, it can never enter targetMarkets.
    root.document.addEventListener("click",event=>{
      const button=event.target?.closest?.("#add-target-market");
      if(!button)return;
      const current=root.document.getElementById("custom-target-market");
      if(!current||!looksLikeUrlOrDomain(current.value))return;
      event.preventDefault();
      event.stopImmediatePropagation();
      current.value="";
      showMisplacedWebsiteMessage();
      root.document.getElementById("company-website")?.focus?.();
    },true);

    [0,100,350,1000,2500].forEach(delay=>root.setTimeout?.(sweep,delay));
    root.setInterval?.(sweep,750);
  }

  const api={looksLikeUrlOrDomain,clearUrlLikeValue,hardenInputSemantics,install};
  root.LeadIntelCustomMarketInputHygiene=api;
  install();
})(typeof globalThis!=="undefined"?globalThis:this);
