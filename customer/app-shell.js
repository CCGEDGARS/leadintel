// Application shell adapter (2026-10-25). With app-shell.css the document itself no longer scrolls above 720px;
// the content column does. Several stage renderers still call window.scrollTo({top:0}) when a step changes, so
// the same call also scrolls the content column. Nothing else is intercepted.
(function(root){
  'use strict';
  if(!root.document||typeof root.scrollTo!=='function'||root.LeadIntelAppShell)return;
  const native=root.scrollTo.bind(root);
  function locked(){try{return root.getComputedStyle(root.document.body).overflow==='hidden';}catch{return false;}}
  function pane(){return root.document.querySelector('main.content');}
  function scrollTo(a,b){
    try{native(a,b);}catch{}
    const main=pane();if(!main||!locked())return;
    const options=typeof a==='object'&&a!==null?a:{top:typeof b==='number'?b:0,left:typeof a==='number'?a:0};
    if(typeof options.top==='number'||typeof options.left==='number')main.scrollTo(options);
  }
  root.scrollTo=scrollTo;
  root.LeadIntelAppShell={locked,pane,scrollTo};
})(typeof window==='object'?window:globalThis);
