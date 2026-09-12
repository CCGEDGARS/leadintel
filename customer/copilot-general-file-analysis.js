import {FILE_LIMITS, SUPPORTED_FILE_FORMATS, validateCopilotFile} from './copilot-file-contract.js';
import {extractCopilotFile} from './copilot-file-extractors.js';

const installations=new WeakMap();
const ACCEPT='.pdf,.docx,.xlsx,.xls,.csv,.pptx';
const FORMATS='PDF, DOCX, XLSX, XLS, CSV or PPTX (up to 15 MB). Resave legacy .doc and .ppt files as .docx or .pptx.';
function node(tag,text,className){const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);if(className)el.className=className;return el;}
function button(text,handler){const el=node('button',text);el.type='button';el.addEventListener('click',handler);return el;}
function workspace(){const bridge=window.LeadIntelServerBridge;return bridge?.session?.authenticated?String(bridge.workspace?.id||''):'';}
function message(error){return error?.name==='AbortError'?'Request timed out or was interrupted. Please retry.':String(error?.message||'Request failed. Please retry.').slice(0,240);}
function discussionContent(item){const content=String(item?.content??'');if(item?.role!=='assistant'||!content.startsWith('{'))return content;try{const parsed=JSON.parse(content);return typeof parsed?.executive_summary==='string'?parsed.executive_summary:content;}catch{return content;}}

export function installGeneralFileAnalysis({api,extractFile=extractCopilotFile,crypto=globalThis.crypto}={}){
  const drawer=document.getElementById('leadintel-copilot-drawer');
  const host=drawer?.querySelector('[data-copilot-general-file-host]');
  if(!host)return null;
  if(installations.has(host))return installations.get(host);
  const root=node('section',undefined,'copilot-general-file-analysis');root.setAttribute('aria-label','General file analysis');host.append(root);
  let state='empty',generation=0,owner=workspace(),file=null,extraction=null,digest='',fileId='',analysis=null,retryAction=null,destroyed=false,historyGeneration=0;
  let operation=new AbortController();const buffers=new Map();const urls=new Set();
  const input=node('input');input.type='file';input.accept=ACCEPT;input.hidden=true;input.setAttribute('aria-label','Choose one file to analyze');
  const choose=button('Analyze Any File',()=>{if(!syncWorkspace())return;input.value='';input.click();});
  const fileLabel=node('p','No file selected.');
  const status=node('p','Select one file to begin.','copilot-file-stage');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.setAttribute('aria-atomic','true');
  const warnings=node('div',undefined,'copilot-general-warnings');
  const request=node('textarea');request.rows=4;request.maxLength=FILE_LIMITS.maxRequestChars;request.setAttribute('aria-label','File analysis request');request.placeholder='What would you like to learn or create from this file?';
  const confirmation=node('label',undefined,'copilot-general-confirmation');const consent=node('input');consent.type='checkbox';consent.setAttribute('aria-label','Proceed with partial extraction');confirmation.append(consent,node('span','I understand that some source content is unavailable. Proceed with partial extraction.'));
  const analyze=button('Analyze File',()=>void runAnalysis());
  const retry=button('Retry',()=>{if(retryAction)void retryAction();});
  const newAnalysis=button('Start new analysis',()=>{reset();choose.focus();});
  const actions=node('div',undefined,'copilot-general-actions');actions.append(analyze,retry,newAnalysis);
  const resultHost=node('article');resultHost.dataset.fileResult='';resultHost.setAttribute('aria-label','File analysis result');
  const followup=node('textarea');followup.rows=3;followup.maxLength=FILE_LIMITS.maxRequestChars;followup.setAttribute('aria-label','Question about this file');
  const ask=button('Ask about file',()=>void continueAnalysis());const reload=button('Reload analysis',()=>{if(analysis)void loadAnalysis(analysis.id,true);});
  const conversation=node('div');conversation.setAttribute('aria-label','File discussion');
  const save=button('Save to workspace',()=>void saveAnalysis());
  const remove=button('Delete analysis',()=>{deleteConfirmation.hidden=false;confirmDelete.focus();});
  const deleteConfirmation=node('div',undefined,'copilot-general-delete');deleteConfirmation.setAttribute('role','group');deleteConfirmation.setAttribute('aria-label','Confirm analysis deletion');
  const confirmDelete=button('Confirm deletion',()=>void deleteAnalysis());const cancelDelete=button('Cancel deletion',()=>{deleteConfirmation.hidden=true;remove.focus();});
  deleteConfirmation.append(node('p','Delete this original file and all its analyses? This cannot be undone.'),confirmDelete,cancelDelete);deleteConfirmation.hidden=true;
  const resultActions=node('div',undefined,'copilot-general-actions');resultActions.append(save,remove,reload);
  const history=node('section');history.setAttribute('aria-label','File Analyses');const historyList=node('div');const historyStatus=node('p');historyStatus.setAttribute('aria-live','polite');
  history.append(node('h3','File Analyses'),button('Refresh file analyses',()=>void loadHistory()),historyStatus,historyList);
  root.append(choose,input,node('p',FORMATS),fileLabel,status,warnings,request,confirmation,actions,resultHost,conversation,followup,ask,resultActions,deleteConfirmation,node('p','Unretained files expire after 24 hours. Saved analyses remain until deleted.'),history);

  function trackBuffer(token,bytes){if(!buffers.has(token))buffers.set(token,new Set());buffers.get(token).add(bytes);}
  function releaseBuffers(token){const owned=buffers.get(token);if(!owned)return;for(const bytes of owned){try{bytes.fill(0);}catch{/* A transferred buffer is already detached. */}}buffers.delete(token);}
  function release(){for(const token of [...buffers.keys()])releaseBuffers(token);for(const url of urls)URL.revokeObjectURL(url);urls.clear();}
  function clearFile(){release();file=null;extraction=null;digest='';input.value='';}
  function transition(next,text){state=next;root.dataset.state=next;status.textContent=text;renderControls();}
  function renderControls(){
    const busy=['selected','extracting','uploading','analyzing','saving','loading'].includes(state);
    root.setAttribute('aria-busy',String(busy));
    analyze.disabled=!fileId||!['extracted','confirmation-required'].includes(state)||confirmation.hidden===false&&!consent.checked;
    request.disabled=busy||Boolean(analysis)||['deleting','stale'].includes(state);
    confirmation.hidden=!extraction||extraction.coverage?.complete!==false||Boolean(analysis);
    retry.hidden=!retryAction||busy;retry.disabled=busy;
    followup.hidden=ask.hidden=resultActions.hidden=conversation.hidden=!analysis;
    ask.disabled=followup.disabled=state!=='ready';save.disabled=state!=='ready'||Boolean(analysis?.retained);remove.disabled=state!=='ready'&&state!=='stale';
    reload.hidden=state!=='stale';confirmDelete.disabled=state==='deleting';
  }
  function reset(text='Select one file to begin.'){
    generation++;operation.abort();operation=new AbortController();clearFile();fileId='';analysis=null;retryAction=null;request.value='';followup.value='';consent.checked=false;warnings.replaceChildren();resultHost.replaceChildren();conversation.replaceChildren();deleteConfirmation.hidden=true;fileLabel.textContent='No file selected.';transition('empty',text);
  }
  function syncWorkspace(){const current=workspace();if(current!==owner){owner=current;historyGeneration++;historyList.replaceChildren();historyStatus.textContent='';reset('Workspace changed. Select a file in this workspace.');return false;}if(!current){reset('Sign in to analyze a file.');return false;}return !destroyed;}
  function current(token){return !destroyed&&syncWorkspace()&&generation===token;}
  function fail(error,retryFn,next='error'){retryAction=retryFn;transition(next,message(error));}
  function response(value){if(!value)throw new Error('Sign in to continue file analysis.');return value;}
  function renderCoverage(target,coverage){if(!coverage)return;target.append(node('h4','Source coverage'),node('p',coverage.complete?'Complete source coverage.':'Partial source coverage — some content was not available to the model.'));const list=node('ul');for(const item of coverage.omitted||[])list.append(node('li',item));target.append(list);}
  function renderExtraction(){warnings.replaceChildren();for(const text of extraction.warnings||[])warnings.append(node('p',text));renderCoverage(warnings,extraction.coverage);}
  function renderResult(){
    resultHost.replaceChildren();const result=analysis.result;
    resultHost.append(node('h3',result.title),node('h4','Executive summary'),node('p',result.executive_summary));
    for(const section of result.sections||[]){const block=node('section');block.append(node('h4',section.heading),node('p',section.content));
      for(const rows of section.tables||[]){const scroll=node('div',undefined,'copilot-general-table');scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label',`${section.heading} table`);const table=node('table');table.append(node('caption',section.heading));rows.forEach((row,index)=>{const tr=node('tr');for(const value of row){const cell=node(index===0?'th':'td',value);if(index===0)cell.scope='col';tr.append(cell);}table.append(tr);});scroll.append(table);block.append(scroll);}
      for(const evidence of section.evidence||[])block.append(node('span',`${evidence.label} (${evidence.locator})`,'copilot-general-evidence'));
      resultHost.append(block);
    }
    for(const [key,label] of [['findings','Findings'],['recommendations','Recommendations'],['risks','Risks'],['assumptions','Assumptions'],['data_gaps','Data gaps'],['warnings','Warnings']]){resultHost.append(node('h4',label));const list=node('ul');for(const item of result[key]||[])list.append(node('li',item));resultHost.append(list);}
    for(const warning of analysis.source_coverage?.warnings||[])resultHost.append(node('p',warning));
    renderCoverage(resultHost,analysis.source_coverage?.coverage);
    conversation.replaceChildren();for(const item of analysis.messages||[])conversation.append(node('p',`${item.role==='user'?'You':'LeadIntel'}: ${discussionContent(item)}`));
  }
  function acceptAnalysis(value){const next=response(value).analysis;if(!next||next.status!=='completed'||!next.id||!next.result||typeof next.result.title!=='string'||typeof next.result.executive_summary!=='string')throw new Error('No completed analysis was returned. Please retry.');analysis=next;fileId=next.file_id;retryAction=null;request.value=next.request;renderResult();transition('ready',next.retained?'Ready. Saved to workspace.':'Ready — not saved. Save to workspace to keep this analysis.');}

  async function selectFiles(files){
    if(!syncWorkspace())return;reset();
    if(!files.length)return;
    if(files.length!==1){transition('rejected','Select only one file per analysis.');return;}
    file=files[0];const extension=file.name?.split('.').pop().toLowerCase();
    if(!SUPPORTED_FILE_FORMATS[extension]||file.size>FILE_LIMITS.maxFileBytes||file.size<=0){clearFile();transition('rejected',FORMATS);return;}
    const token=generation;fileLabel.textContent=file.name;transition('selected','File selected. Validating…');
    try{
      const bytes=new Uint8Array(await file.arrayBuffer());trackBuffer(token,bytes);
      if(!current(token)){releaseBuffers(token);return;}
      const signature=Array.from(bytes.subarray(0,32),value=>value.toString(16).padStart(2,'0')).join('');
      const valid=validateCopilotFile({name:file.name,type:file.type,size:bytes.length,signature});
      if(!valid.ok){clearFile();transition('rejected',valid.errors.join(' ')+' '+FORMATS);return;}
      const nextDigest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('');releaseBuffers(token);
      if(!current(token))return;digest=nextDigest;
      transition('extracting','Extracting source content…');const extracted=await extractFile(file);
      if(!current(token))return;
      if(!extracted?.blocks?.some(block=>block.text?.trim()||block.table?.some(row=>row.some(cell=>String(cell).trim()))))throw new Error('No usable content was extracted. Choose a readable file.');
      extraction=extracted;renderExtraction();await upload(token);
    }catch(error){releaseBuffers(token);if(current(token)){clearFile();fail(error,null);}}
  }
  async function upload(token=generation){
    if(!current(token)||!file||!extraction)return;retryAction=null;transition('uploading','Uploading unchanged original…');
    try{const value=response(await api.uploadCopilotFile({file,extraction,sha256:digest,extractorVersion:'web-1'},{signal:operation.signal}));if(!current(token))return;if(!value.file_id)throw new Error('Upload did not return a file identifier.');fileId=value.file_id;file=null;digest='';releaseBuffers(token);input.value='';transition(extraction.coverage?.complete===false?'confirmation-required':'extracted',extraction.coverage?.complete===false?'Extracted partially. Confirm the coverage warning before analysis.':'Extracted. Enter your request and select Analyze File.');request.focus();}
    catch(error){releaseBuffers(token);if(current(token))fail(error,()=>upload());}
  }
  async function runAnalysis(){
    if(!syncWorkspace()||!fileId||analysis||!['extracted','confirmation-required','error'].includes(state))return;
    if(extraction?.coverage?.complete===false&&!consent.checked)return;
    const text=request.value.trim();if(!text||text.length>FILE_LIMITS.maxRequestChars){status.textContent='Enter a request of 1–8,000 characters.';request.focus();return;}
    const token=generation;retryAction=null;transition('analyzing','Analyzing the file with cited source evidence…');
    try{const value=await api.analyzeCopilotFile({file_id:fileId,request:text,partial_confirmed:consent.checked},{signal:operation.signal});if(current(token)){acceptAnalysis(value);extraction=null;warnings.replaceChildren();clearFile();}}
    catch(error){if(current(token))fail(error,()=>runAnalysis());}
  }
  async function continueAnalysis(){
    if(!syncWorkspace()||!analysis||!['ready','error'].includes(state))return;const text=followup.value.trim();if(!text||text.length>FILE_LIMITS.maxRequestChars){status.textContent='Enter a question of 1–8,000 characters.';followup.focus();return;}
    const token=generation;retryAction=null;transition('analyzing','Analyzing your follow-up. Previous result remains below.');
    try{const value=await api.continueCopilotFileAnalysis(analysis.id,text,{signal:operation.signal});if(current(token)){const messages=[...(analysis.messages||[]),{role:'user',content:text},{role:'assistant',content:value?.analysis?.result?.executive_summary||''}].slice(-12);acceptAnalysis(value);analysis.messages=messages;renderResult();followup.value='';followup.focus();}}
    catch(error){if(current(token)){if(error.status===409)fail(new Error('This analysis changed in another session. Reload analysis before sending your question again.'),null,'stale');else{retryAction=()=>continueAnalysis();transition('ready',`Follow-up failed. ${message(error)} Your previous result remains available.`);}}}
  }
  async function saveAnalysis(){
    if(!syncWorkspace()||!analysis||state!=='ready')return;const token=generation;transition('saving','Saving analysis…');
    try{response(await api.saveCopilotFileAnalysis(analysis.id,{signal:operation.signal}));if(current(token)){analysis.retained=true;transition('ready','Saved to workspace.');void loadHistory();}}
    catch(error){if(current(token))transition('ready',`Not saved. ${message(error)} Your result is still available in this session.`);}
  }
  async function deleteAnalysis(){
    if(!syncWorkspace()||!analysis)return;const token=generation;retryAction=null;deleteConfirmation.hidden=true;transition('deleting','Deleting original and related analyses…');
    try{response(await api.deleteCopilotFileAnalysis(analysis.id,{signal:operation.signal}));if(current(token)){reset('Deleted original file and related analyses.');void loadHistory();choose.focus();}}
    catch(error){if(current(token))fail(new Error(`Deletion incomplete. Retry deletion. ${message(error)}`),()=>deleteAnalysis(),'deleting');}
  }
  async function loadAnalysis(id,preserveDraft=false){
    if(!syncWorkspace())return;const draft=preserveDraft?followup.value:'';reset();followup.value=draft;const token=generation;transition('loading','Loading saved analysis…');
    try{const value=await api.getCopilotFileAnalysis(id,{signal:operation.signal});if(current(token)){acceptAnalysis(value);fileLabel.textContent='Saved source file';}}
    catch(error){if(current(token))fail(error,()=>loadAnalysis(id,preserveDraft));}
  }
  async function loadHistory(){
    if(!syncWorkspace())return;const id=++historyGeneration,scope=owner;historyStatus.textContent='Loading saved file analyses…';
    try{const value=response(await api.listCopilotFileAnalyses());if(destroyed||id!==historyGeneration||scope!==workspace())return;historyList.replaceChildren();for(const item of value.analyses||[])historyList.append(button(item.title||'Untitled analysis',()=>void loadAnalysis(item.id)));historyStatus.textContent=value.analyses?.length?'':'No saved file analyses.';}
    catch(error){if(!destroyed&&id===historyGeneration&&scope===workspace())historyStatus.textContent=`Unable to load history. ${message(error)}`;}
  }
  consent.addEventListener('change',renderControls);
  input.addEventListener('change',()=>{const files=Array.from(input.files||[]);input.value='';void selectFiles(files);});
  for(const [field,action] of [[request,runAnalysis],[followup,continueAnalysis]])field.addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();void action();}});
  const onClose=()=>reset();drawer.addEventListener('leadintel:copilot-closed',onClose);
  const onWorkspace=()=>{if(!syncWorkspace())void loadHistory();};window.addEventListener('leadintel:workspace-changed',onWorkspace);
  const controller={root,reset,destroy(){destroyed=true;historyGeneration++;reset();drawer.removeEventListener('leadintel:copilot-closed',onClose);window.removeEventListener('leadintel:workspace-changed',onWorkspace);root.remove();installations.delete(host);}};
  installations.set(host,controller);renderControls();transition('empty','Select one file to begin.');void loadHistory();return controller;
}
