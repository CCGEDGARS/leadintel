import './research-task-model.js?v=20261118-v1&company-list-quality=20261119-v2';
const T=globalThis.LeadIntelResearchTasks;
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const button=(label,fn)=>{const n=el('button',label);n.type='button';n.addEventListener('click',fn);return n;};
function download(content,type,name){const url=URL.createObjectURL(new Blob([content],{type})),a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function attachTask(card,initial,{api,isCurrent}){
 const host=el('section');host.className='copilot-task';host.dataset.researchTask=initial.id;host.setAttribute('aria-label','Research task');card.append(host);
 let task=initial,busy=false,epoch=0,timer;
 const current=()=>host.isConnected&&isCurrent();
 const path='/api/copilot/tasks/'+encodeURIComponent(initial.id);
 function message(text){const n=el('p',text);n.className='copilot-task-error';n.setAttribute('role','alert');host.append(n);}
 async function refresh(){if(!current()||busy)return;const generation=epoch;try{const response=await api.requestCopilot(path);if(!current()||generation!==epoch)return;task=response.task;render();}catch(e){if(current())message('Progress connection failed: '+e.message+'. Saved research may still be running.');}finally{schedule();}}
 function schedule(){clearTimeout(timer);if(current()&&task.status==='running')timer=setTimeout(refresh,4000);}
 async function command(action,answers){if(busy||!current())return;busy=true;epoch++;host.querySelectorAll('button').forEach(b=>b.disabled=true);try{const result=await api.requestCopilot(path,{method:'POST',body:{action,revision:task.revision,...(answers?{answers}:{})}});if(!current())return;task=result.task;render();}catch(e){if(current()){if(e.status===409){try{const latest=await api.requestCopilot(path);if(current())task=latest.task;}catch{}}if(current()){render();message(e.message);}}}finally{busy=false;schedule();}}
 function field(form,key,label,{options,multiple=false,type='text',value,min,max}={}){
  const wrap=el('label'),caption=el('span',label);wrap.append(caption);let control;
  if(options){control=el('select');control.multiple=multiple;if(!multiple)control.append(new Option('Choose…',''));for(const option of options){const o=new Option(option.label,String(option.value));o.selected=multiple?(value||[]).includes(option.value):String(value??'')===String(option.value);control.append(o);}}
  else{control=el('input');control.type=type;if(type==='checkbox')control.checked=value===true;else control.value=Array.isArray(value)?value.join('; '):value??'';if(min!==undefined)control.min=min;if(max!==undefined)control.max=max;}
  control.name=key;wrap.append(control);form.append(wrap);return control;
 }
 function formFor(){
  const form=el('form'),p=task.plan||{},o=task.options||{};form.className='copilot-task-form';
  field(form,'flowId','Saved Flow',{options:(o.flows||[]).map(f=>({value:f.id,label:f.name})),value:p.flowId});
  field(form,'count','Number of companies (1–200)',{type:'number',min:1,max:200,value:p.count});
  field(form,'markets','Countries (separate with semicolons)',{value:p.markets});
  field(form,'marketOverride','Use these countries for this task, including a difference from the Flow',{type:'checkbox',value:p.marketOverride});
  field(form,'signalIds','Signals used for ranking',{multiple:true,options:(o.signals||[]).map(s=>({value:s.id,label:s.name||s.label||s.id})),value:p.signalIds});
  field(form,'mode','Signal matching',{options:[{value:'any',label:'At least one selected signal'},{value:'all',label:'Every selected signal'}],value:p.mode||'any'});
  field(form,'referenceIds','Analyzed reference companies (1–15 for lookalikes)',{multiple:true,options:(o.references||[]).filter(r=>r.ready).map(r=>({value:r.id,label:r.company||r.name||r.website})),value:p.referenceIds});
  field(form,'buyerCount','Decision-makers (0–4; zero for companies only)',{type:'number',min:0,max:4,value:p.buyerCount});
  field(form,'buyerScope','Decision-maker count applies',{options:[{value:'per_company',label:'Per company'},{value:'total',label:'In total'}],value:p.buyerScope});
  field(form,'buyerCompanies','Research buyers at the top N companies (up to 10)',{type:'number',min:1,max:10,value:p.buyerCompanies});
  field(form,'roles','Decision-maker roles (separate with semicolons)',{value:p.roles});
  field(form,'phoneEvidence','Required phone evidence',{options:[{value:'none',label:'Phone optional'},{value:'confirmed',label:'Named public source or verified provider'},{value:'provider_verified',label:'Verified provider only'}],value:p.phoneEvidence});
  field(form,'paidMode','Paid contact permission',{options:[{value:'off',label:'Public research only'},{value:'saved_policy',label:'Use saved provider policy and limits'}],value:p.paidMode});
  field(form,'budget','Company-research operation allowance (10–5,000)',{type:'number',min:10,max:5000,value:p.budget});
  field(form,'format','Result format',{options:[{value:'app',label:'In-app list'},{value:'csv',label:'CSV'},{value:'word',label:'Word (.doc)'},{value:'pdf',label:'PDF (print / save)'}],value:p.format});
  const save=el('button','Review these answers');save.type='submit';form.append(save);form.addEventListener('submit',event=>{event.preventDefault();const answer={};for(const c of form.elements){if(!c.name)continue;answer[c.name]=c.multiple?[...c.selectedOptions].map(o=>o.value):c.type==='checkbox'?c.checked:['markets','roles'].includes(c.name)?c.value.split(/[;\n]/).map(v=>v.trim()).filter(Boolean):c.value;}void command('update',answer);});return form;
 }
 async function saveCrm(){if(busy||!current())return;busy=true;epoch++;host.querySelectorAll('button').forEach(b=>b.disabled=true);try{let list=(await api.requestCopilot('/api/company-lists?id='+encodeURIComponent(task.listId))).list;
  let cursor=0;do{if(!current())return;const result=await api.requestCopilot('/api/company-lists',{method:'POST',body:{action:'save',id:list.id,revision:list.revision,cursor}});list=result.list;cursor=result.nextCursor;}while(cursor!==null);
  if(current()){task.saved=true;render();}
 }catch(e){if(current()){render();message(e.message);}}finally{busy=false;}}
 function render(){
  host.replaceChildren();host.dataset.status=task.status||'loading';if(!task.plan){host.append(el('p','Loading saved research task…'));return;}
  const heading=el('h4',({draft:'Action required — clarify task',ready:'Ready for your review',running:'Research in progress',blocked:'Research blocked — action required',paused:'Research paused',complete:'Requested research complete'})[task.status]||'Research task');host.append(heading);
  const p=task.plan||{},policy=task.options?.policy||{};
  host.append(el('p',`${task.flowName||'Choose a Flow'} · ${p.count||'?'} ${p.count===1?'company':'companies'} · ${(p.markets||[]).join(', ')||'Choose countries'}`));
  host.append(el('p',`Ranking (${p.mode||'any'} selected signal${p.mode==='all'?'s':''}): ${(p.signalIds||[]).join(', ')} · ${p.signalIds?.includes('lookalike')?p.referenceIds?.length||0:0} references used · Output: ${p.format||'Choose a format'}`));
  host.append(el('p',p.buyerCount?`${p.buyerCount} decision-makers ${p.buyerScope==='total'?'in total':'per company'}, researching the top ${p.buyerCompanies||'?'} companies. Roles: ${(p.roles||[]).join(', ')}. Phone: ${p.phoneEvidence}. Buyer research saves the selected companies in CRM; existing company records are preserved.`:'Companies only. You can save the list and research buyers later.'));
  host.append(el('p',`${p.budget} company-research operations. Web and reasoning providers may consume subscription credits. Buyer research uses its existing bounded company and committee checks separately. Paid contacts: ${p.paidMode==='saved_policy'?`${policy.provider} ${p.phoneEvidence==='none'?'email':'phone'} · up to ${Math.min(policy.automaticBuyerLimit||1,p.buyerCount||0)} buyers/company, ${policy.dailyLimit}/day and ${policy.monthlyLimit}/month across the workspace`:'off'}. No messages are sent.`));
  if(task.blocker){const problem=el('div');problem.className='copilot-task-blocker';problem.setAttribute('role','status');problem.append(el('strong',task.blocker.title),el('p',task.blocker.reason),el('p','Next: '+task.blocker.action+'. Completed results are retained.'));if(task.blocker.target==='settings')problem.append(button('Open settings',()=>{const control=document.getElementById('open-settings');if(control){window.LeadIntelCopilotUi?.closeCopilot();control.click();}else message('Open Settings from the workspace controls to review provider connections and billing.');}));host.append(problem);}
  if(task.questions?.length&&task.status==='draft'){const list=el('ul');for(const q of task.questions)list.append(el('li',q.title));host.append(list);}
  if(['draft','ready'].includes(task.status)){const details=el('details');details.open=task.status==='draft';details.append(el('summary','Task details and answers'),formFor());host.append(details);}
  const actions=el('div');actions.className='copilot-task-actions';host.append(actions);
  if(task.status==='ready')actions.append(button('Run reviewed task',()=>command('run')));
  if(task.status==='running')actions.append(button('Pause research',()=>command('pause')));
  if(['blocked','paused'].includes(task.status)){const exhausted=task.progress?.operations>=task.progress?.allowance;actions.append(button(exhausted?`Add ${p.budget} operations and continue`:task.blocker?.code==='shortfall'?'Recheck saved contact evidence':'Continue within reviewed allowance',()=>command(exhausted?'extend':'resume')));}
  if(!['draft','ready'].includes(task.status)){host.append(el('p',`${task.progress?.count||0}/${p.count} companies · ${task.progress?.operations||0}/${task.progress?.allowance||p.budget} company operations · ${task.buyerProgress||task.progress?.reason||''}`));}
  if(task.results?.length){
   const detail=el('details');detail.append(el('summary',`${task.results.length} ranked companies${task.status!=='complete'?' · partial results':''}`));
   const list=el('ol');for(const company of task.results){const item=el('li'),link=el('a',company.company);if(/^https?:\/\//.test(company.website)){link.href=company.website;link.target='_blank';link.rel='noopener noreferrer';}item.append(link,el('span',` — ${company.location||company.market} · ${company.score}/100`));const why=el('details');why.append(el('summary','Evidence and relevance'));for(const match of company.matches||[]){why.append(el('p',`${match.name||match.signalId}: ${match.reason||''}`),el('blockquote',match.quote||''));if(/^https?:\/\//.test(match.url||'')){const source=el('a','Read source');source.href=match.url;source.target='_blank';source.rel='noopener noreferrer';why.append(source);}}item.append(why);for(const buyer of company.buyers||[])item.append(el('p',`${buyer.name} · ${buyer.role}${buyer.phone?' · '+buyer.phone+' ('+buyer.phoneStatus+')':''}`));list.append(item);}detail.append(list);host.append(detail);
   if(task.status!=='running'){const save=button(task.saved?'Saved in CRM':'Save companies in CRM',saveCrm);save.disabled=task.saved;actions.append(save);}
   actions.append(button('Download CSV',()=>download(T.csv(task),'text/csv;charset=utf-8','leadintel-research.csv')),button('Download Word',()=>download(T.documentHtml(task),'application/msword','leadintel-research.doc')),button('Print / save PDF',()=>{const win=window.open('','_blank');if(!win){message('Allow the print preview window to save a PDF.');return;}win.opener=null;win.document.write(T.documentHtml(task));win.document.close();win.focus();win.print();}));
  }
  host.append(el('small','Task reference: '+task.id));
  if(task.receipts?.length){const d=el('details');d.append(el('summary','Research execution receipts'));for(const r of task.receipts.slice(-15))d.append(el('p',`${r.operation||r.tool||'Check'} · ${r.status||'recorded'} · ${r.at||''}`));host.append(d);}
 }
 render();void refresh();
}
