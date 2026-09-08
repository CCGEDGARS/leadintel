const CREDIT_RATES=Object.freeze({email:1,phone:9});
const selected=new Set();
let observer=null;
let decorating=false;
let bulkRunning=false;

export function estimateApolloCredits(count,type='email'){
  const safeCount=Math.max(0,Number.parseInt(count,10)||0);
  const rate=CREDIT_RATES[type]||0;
  return safeCount*rate;
}

export function bulkConfirmationMessage(count,type='email'){
  const safeCount=Math.max(0,Number.parseInt(count,10)||0);
  const credits=estimateApolloCredits(safeCount,type);
  const action=type==='phone'?'phone enrichment':'business-email verification';
  return `${safeCount} contacts selected. ${action} may use up to ${credits} Apollo credits. Only the selected contacts will be processed. Proceed?`;
}

export function contactSelectionKey(companyIndex,personIndex,identity=''){
  const safeIdentity=encodeURIComponent(String(identity||'').replace(/\s+/g,' ').trim().toLowerCase()).slice(0,120);
  return `${companyIndex}:${personIndex}:${safeIdentity}`;
}
function parseKey(key){const [companyIndex,personIndex]=String(key).split(':').map(Number);return {companyIndex,personIndex};}
function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function rowIdentity(row){return [row.querySelector('strong')?.textContent,row.querySelector('span')?.textContent,row.querySelector('small')?.textContent].map(value=>String(value||'').trim()).filter(Boolean).join('|');}

function style(){
  if(typeof document==='undefined'||document.getElementById('apollo-bulk-enrichment-style'))return;
  const node=document.createElement('style');node.id='apollo-bulk-enrichment-style';node.textContent=`
    .apollo-cost-note{margin:8px 0 10px;padding:9px 11px;border:1px solid rgba(148,163,184,.24);border-radius:10px;background:rgba(148,163,184,.06);font-size:12px;line-height:1.45;color:var(--muted,#64748b)}
    .apollo-select-wrap{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--muted,#64748b);margin-right:4px;white-space:nowrap}
    .apollo-select-wrap input{width:15px;height:15px;margin:0}
    .apollo-bulk-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 12px;padding:10px 12px;border:1px solid rgba(148,163,184,.24);border-radius:12px;background:rgba(15,23,42,.03)}
    .apollo-bulk-toolbar strong{margin-right:auto;font-size:13px}.apollo-bulk-toolbar small{width:100%;color:var(--muted,#64748b)}
  `;document.head.appendChild(node);
}

function updateToolbar(){
  if(typeof document==='undefined')return;
  const toolbar=document.getElementById('apollo-bulk-toolbar');if(!toolbar)return;
  const count=selected.size;
  const countNode=toolbar.querySelector('[data-apollo-selected-count]');if(countNode&&countNode.textContent!==String(count))countNode.textContent=String(count);
  toolbar.querySelectorAll('button').forEach(button=>{const disabled=bulkRunning||count===0;if(button.disabled!==disabled)button.disabled=disabled;});
}

function ensureToolbar(){
  const target=document.getElementById('company-candidates');if(!target||document.getElementById('apollo-bulk-toolbar'))return;
  target.insertAdjacentHTML('beforebegin',`<div class="apollo-bulk-toolbar" id="apollo-bulk-toolbar">
    <strong><span data-apollo-selected-count>0</span> selected</strong>
    <button class="secondary-btn small" type="button" data-apollo-bulk="email">Verify selected emails with Apollo</button>
    <button class="secondary-btn small" type="button" data-apollo-bulk="phone">Find selected phones with Apollo</button>
    <small>Finding people does not reveal contact details. Apollo email or phone enrichment runs only after you select contacts and confirm the estimated credit use.</small>
  </div>`);
  updateToolbar();
}

function decoratePersonRow(row){
  const emailButton=row.querySelector('[data-action="enrich-contact"]');
  const phoneButton=row.querySelector('[data-action="find-phone"],[data-action="refresh-phone"]');
  const source=emailButton||phoneButton;if(!source)return;
  const companyIndex=source.dataset.companyIndex;const personIndex=source.dataset.personIndex;
  if(companyIndex==null||personIndex==null)return;
  const key=contactSelectionKey(companyIndex,personIndex,rowIdentity(row));
  const actions=row.querySelector('.person-actions');
  if(actions&&!actions.querySelector('[data-apollo-select]')){
    actions.insertAdjacentHTML('afterbegin',`<label class="apollo-select-wrap" title="Select this contact for an Apollo bulk action"><input type="checkbox" data-apollo-select="${esc(key)}" ${selected.has(key)?'checked':''}> Select</label>`);
  }
  const checkbox=actions?.querySelector('[data-apollo-select]');if(checkbox){checkbox.dataset.apolloSelect=key;checkbox.checked=selected.has(key);}
  if(emailButton&&!/Working|verified/i.test(emailButton.textContent||'')){
    const emailLabel=emailButton.disabled?'Sign in to verify email':'Verify email with Apollo · 1 credit';
    if(emailButton.textContent!==emailLabel)emailButton.textContent=emailLabel;
  }
  if(phoneButton&&phoneButton.dataset.action==='find-phone'&&!/verified/i.test(phoneButton.textContent||'')){
    const phoneLabel=phoneButton.disabled?'Sign in to find phone':'Find phone with Apollo · up to 9 credits';
    if(phoneButton.textContent!==phoneLabel)phoneButton.textContent=phoneLabel;
  }
}

function decorateDecisionSection(section){
  if(!section.querySelector('.apollo-cost-note')){
    const head=section.querySelector('.decision-head');head?.insertAdjacentHTML('afterend','<div class="apollo-cost-note">Finding people does not reveal contact details. Verify email with Apollo · 1 credit per selected contact. Find phone with Apollo · up to 9 credits per selected contact.</div>');
  }
  section.querySelectorAll('.person-row').forEach(decoratePersonRow);
}

function pruneStaleSelections(){
  const live=new Set([...document.querySelectorAll('[data-apollo-select]')].map(input=>input.dataset.apolloSelect));
  for(const key of selected)if(!live.has(key))selected.delete(key);
}

function decorate(){
  if(typeof document==='undefined'||decorating)return;decorating=true;
  try{style();ensureToolbar();document.querySelectorAll('.decision-makers').forEach(decorateDecisionSection);pruneStaleSelections();updateToolbar();}finally{decorating=false;}
}

function actionSelector(key,type){
  const {companyIndex,personIndex}=parseKey(key);
  const action=type==='phone'?'find-phone':'enrich-contact';
  return `[data-action="${action}"][data-company-index="${companyIndex}"][data-person-index="${personIndex}"]`;
}

async function waitForCompletion(key,type,timeoutMs=30000){
  const started=Date.now();await new Promise(resolve=>setTimeout(resolve,80));
  while(Date.now()-started<timeoutMs){
    decorate();
    const button=document.querySelector(actionSelector(key,type));
    if(type==='phone'){
      const {companyIndex,personIndex}=parseKey(key);
      const refresh=document.querySelector(`[data-action="refresh-phone"][data-company-index="${companyIndex}"][data-person-index="${personIndex}"]`);
      if(refresh||!button)return true;
    }else if(!button||!/Working/i.test(button.textContent||'')&&!button.disabled)return true;
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  return false;
}

async function runBulk(type){
  if(bulkRunning||selected.size===0)return;
  const keys=[...selected];
  if(!window.confirm(bulkConfirmationMessage(keys.length,type)))return;
  bulkRunning=true;updateToolbar();
  let started=0;
  try{
    for(const key of keys){
      decorate();const button=document.querySelector(actionSelector(key,type));
      if(!button||button.disabled)continue;
      started++;button.click();await waitForCompletion(key,type);
    }
  }finally{
    bulkRunning=false;decorate();
    const toast=document.getElementById('toast');if(toast){toast.textContent=`Apollo ${type==='phone'?'phone':'email'} action started for ${started} selected contact${started===1?'':'s'}.`;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),3000);}
  }
}

function bind(){
  if(typeof document==='undefined')return;
  document.addEventListener('change',event=>{const input=event.target.closest?.('[data-apollo-select]');if(!input)return;const key=input.dataset.apolloSelect;if(input.checked)selected.add(key);else selected.delete(key);updateToolbar();});
  document.addEventListener('click',event=>{const button=event.target.closest?.('[data-apollo-bulk]');if(button)runBulk(button.dataset.apolloBulk);});
  observer=new MutationObserver(()=>decorate());observer.observe(document.body,{childList:true,subtree:true});
  decorate();
}

if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
}

export {CREDIT_RATES,runBulk};
