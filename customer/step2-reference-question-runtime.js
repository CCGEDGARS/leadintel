const STEP2_REFERENCE_STORAGE_KEY='leadintel_customer_v2_state';
const STEP2_REFERENCE_VERSION='20260909-question03-v3';

(function installStep2ReferenceQuestionRuntime(root){
  'use strict';
  if(typeof document==='undefined')return;

  const QUESTION_ID='lookalike_customers';
  const QUESTION='Which 3–5 existing customers would you most like to replicate?';
  const HELP='Optional if confidential. Add customer names here for quick context, or open Reference Customer Intelligence to upload company names + websites for AI analysis and lookalike modelling.';
  const PLACEHOLDER='Example: Customer A; Customer B; Customer C';
  let observer=null;
  let queued=false;

  function readState(){
    try{return JSON.parse(localStorage.getItem(STEP2_REFERENCE_STORAGE_KEY)||'{}');}
    catch{return {};}
  }

  function questionGrid(){return document.querySelector('#step-2 .question-grid');}
  function cardFor(id){return document.querySelector(`#step-2 [data-question="${id}"]`)?.closest?.('.question-card')||null;}

  function createReferenceCard(){
    const article=document.createElement('article');
    article.className='question-card';
    article.dataset.referenceQuestionCard='true';
    article.innerHTML=`<span>03</span><label>${QUESTION}<small>${HELP}</small></label><textarea data-question="${QUESTION_ID}" rows="3" placeholder="${PLACEHOLDER}"></textarea>`;
    const saved=String(readState()?.answers?.[QUESTION_ID]||'');
    const textarea=article.querySelector(`[data-question="${QUESTION_ID}"]`);
    if(textarea&&saved)textarea.value=saved;
    return article;
  }

  function ensureReferenceAction(card){
    if(!card||card.querySelector('[data-step2-reference-action]'))return;
    const action=document.createElement('div');
    action.className='step2-reference-action';
    action.dataset.step2ReferenceAction='true';
    action.innerHTML='<button class="secondary-btn small" type="button" data-reference-customers-manage>Open Reference Customer Intelligence <span>→</span></button><small>Upload company names + websites to analyze your best customers and build a stronger lookalike model.</small>';
    const textarea=card.querySelector(`[data-question="${QUESTION_ID}"]`);
    if(textarea)textarea.insertAdjacentElement('afterend',action);else card.appendChild(action);
  }

  function normalizeReferenceCard(card){
    if(!card)return null;
    if(card.hidden)card.hidden=false;
    if(card.hasAttribute('aria-hidden'))card.removeAttribute('aria-hidden');
    if(card.style.display)card.style.removeProperty('display');
    if(card.dataset.referenceQuestionCard!=='true')card.dataset.referenceQuestionCard='true';

    const number=card.firstElementChild;
    if(number?.tagName==='SPAN'&&number.textContent!=='03')number.textContent='03';
    const label=card.querySelector('label');
    if(label){
      const small=label.querySelector('small');
      if(label.childNodes?.[0]&&label.childNodes[0].textContent!==QUESTION)label.childNodes[0].textContent=QUESTION;
      if(small&&small.textContent!==HELP)small.textContent=HELP;
    }
    const textarea=card.querySelector(`[data-question="${QUESTION_ID}"]`);
    if(textarea&&textarea.placeholder!==PLACEHOLDER)textarea.placeholder=PLACEHOLDER;
    ensureReferenceAction(card);
    return card;
  }

  function ensureReferenceQuestion(){
    const grid=questionGrid();if(!grid)return false;
    let card=cardFor(QUESTION_ID);
    if(!card){
      card=createReferenceCard();
      const buyer=cardFor('buyer_roles');
      const ideal=cardFor('ideal_customer');
      if(buyer?.parentElement===grid)grid.insertBefore(card,buyer);
      else if(ideal?.parentElement===grid)ideal.insertAdjacentElement('afterend',card);
      else grid.prepend(card);
    }
    normalizeReferenceCard(card);
    return true;
  }

  function injectCss(){
    if(document.getElementById('step2-reference-question-css'))return;
    const style=document.createElement('style');
    style.id='step2-reference-question-css';
    style.textContent='.step2-reference-action{display:grid;gap:7px;margin-top:10px;padding-top:10px;border-top:1px solid #e8ece9}.step2-reference-action .secondary-btn{justify-self:start}.step2-reference-action small{color:var(--muted,#6c7772);font-size:12px;line-height:1.45}.question-card[data-reference-question-card="true"]{display:block!important}';
    document.head.appendChild(style);
  }

  function sync(){queued=false;injectCss();ensureReferenceQuestion();}
  function scheduleSync(){if(queued)return;queued=true;queueMicrotask(sync);}

  function observeQuestionGrid(){
    const grid=questionGrid();
    if(!grid||observer||typeof MutationObserver==='undefined')return;
    observer=new MutationObserver(scheduleSync);
    observer.observe(grid,{childList:true,subtree:true});
  }

  function start(){sync();observeQuestionGrid();}

  root.addEventListener('leadintel:module-opened',event=>{if(Number(event?.detail?.step)===2)setTimeout(start,0);});
  root.addEventListener('leadintel:workspace-changed',()=>setTimeout(start,0));
  root.addEventListener('leadintel:reference-customers-updated',()=>setTimeout(start,0));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  setTimeout(start,250);
  setTimeout(start,1200);

  root.LeadIntelStep2ReferenceQuestion={version:STEP2_REFERENCE_VERSION,ensureReferenceQuestion};
})(globalThis);
