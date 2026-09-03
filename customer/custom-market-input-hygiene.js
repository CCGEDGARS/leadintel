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

  function replaceAutofilledControl(input){
    if(!input?.parentNode)return input;
    const replacement=root.document.createElement("input");
    replacement.id="custom-target-market";
    replacement.className=input.className||"";
    replacement.placeholder=input.getAttribute?.("placeholder")||"Example: Swedish construction sector or EU distributors";
    replacement.value="";
    replacement.setAttribute("aria-label",input.getAttribute?.("aria-label")||"Custom target market");
    const describedBy=input.getAttribute?.("aria-describedby");
    if(describedBy)replacement.setAttribute("aria-describedby",describedBy);
    hardenInputSemantics(replacement);
    input.replaceWith(replacement);
    return replacement;
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
    const original=root.document.getElementById("custom-target-market");
    if(!original)return;
    root.__leadintelCustomMarketInputHygieneInstalled=true;

    // Browser session restore can remain attached to the original form control even
    // after its value/attributes are changed. Replace it once with a genuinely new,
    // empty market input so restored website state cannot remain painted on the node.
    replaceAutofilledControl(original);

    const sweep=()=>{
      const current=root.document.getElementById("custom-target-market");
      if(!current)return null;
      hardenInputSemantics(current);
      if(looksLikeUrlOrDomain(current.value))return replaceAutofilledControl(current);
      return current;
    };

    // Delegated listeners survive node replacement and guard delayed browser restore.
    root.document.addEventListener("input",event=>{
      if(event.target?.id==="custom-target-market")sweep();
    },true);
    root.document.addEventListener("focusin",event=>{
      if(event.target?.id==="custom-target-market")sweep();
    },true);
    root.addEventListener?.("pageshow",sweep);
    root.document.addEventListener("visibilitychange",sweep,true);

    // app.js attached Enter handling to the original input. Recreate that behavior
    // through delegation so the fresh replacement still adds a legitimate market.
    root.document.addEventListener("keydown",event=>{
      if(event.target?.id!=="custom-target-market"||event.key!=="Enter")return;
      event.preventDefault();
      root.document.getElementById("add-target-market")?.click();
    },true);

    // Final safety gate runs before app.js' normal + Add market handler. Even if a
    // browser injects a URL again, it can never enter targetMarkets.
    root.document.addEventListener("click",event=>{
      const button=event.target?.closest?.("#add-target-market");
      if(!button)return;
      const current=root.document.getElementById("custom-target-market");
      if(!current||!looksLikeUrlOrDomain(current.value))return;
      event.preventDefault();
      event.stopImmediatePropagation();
      replaceAutofilledControl(current);
      showMisplacedWebsiteMessage();
      root.document.getElementById("company-website")?.focus?.();
    },true);

    [0,100,350,1000,2500].forEach(delay=>root.setTimeout?.(sweep,delay));
    root.setInterval?.(sweep,750);
  }

  const api={looksLikeUrlOrDomain,clearUrlLikeValue,hardenInputSemantics,replaceAutofilledControl,install};
  root.LeadIntelCustomMarketInputHygiene=api;
  install();
})(typeof globalThis!=="undefined"?globalThis:this);
