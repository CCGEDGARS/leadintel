let deps=null;
let drawer=null;
let conversationId='';
let pending=false,conversationWorkspace='';
function workspaceId(){return String(window.LeadIntelServerBridge?.workspace?.id||'');}

function ensureCss(){if(document.querySelector('link[data-leadintel-asset="copilot-css"]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href='./copilot.css?v=20261011-business-research-v1';link.dataset.leadintelAsset='copilot-css';document.head.appendChild(link);}
function node(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=String(text);return el;}
function safeUrl(value){try{const url=new URL(String(value||''));return /^https?:$/.test(url.protocol)?url.toString():'';}catch{return '';}}
function closeCopilot(){if(!drawer)return;drawer.hidden=true;document.getElementById('leadintel-copilot-entry')?.focus();}
function onKeydown(event){if(event.key==='Escape'&&drawer&&!drawer.hidden)closeCopilot();}
export function copilotWorkspaceSaveState(persistence=window.LeadIntelWorkspacePersistence){const saved=Boolean(persistence?.isExplicitlySaved?.());if(!saved)return {current:false,reason:'not-saved'};if(Boolean(persistence?.hasUnsavedChanges?.()))return {current:false,reason:'unsaved-changes'};return {current:true,reason:''};}
function clear(el){while(el.firstChild)el.removeChild(el.firstChild);}


function ensureDrawer(){
  if(drawer)return drawer;ensureCss();drawer=node('aside','leadintel-copilot-drawer');drawer.id='leadintel-copilot-drawer';drawer.setAttribute('role','dialog');drawer.setAttribute('aria-modal','false');drawer.setAttribute('aria-label','Ask LeadIntel');drawer.hidden=true;
  const header=node('header','copilot-header');const titleWrap=node('div');titleWrap.append(node('strong','copilot-title','Ask LeadIntel ✦'),node('span','copilot-subtitle','Business & Research'));
  const close=node('button','copilot-close','×');close.type='button';close.setAttribute('aria-label','Close Copilot');close.addEventListener('click',closeCopilot);header.append(titleWrap,close);
  const intro=node('section','copilot-intro');intro.append(node('strong','copilot-intro-title','Your AI business assistant.'),node('p','copilot-intro-copy','Ask about your workspace, companies, markets, sales strategy or tools. LeadIntel can research public sources, explain findings and help you decide your next step.'));
  const messages=node('section','copilot-messages');messages.dataset.copilotMessages='';const proposals=node('section','copilot-proposals');proposals.dataset.copilotProposals='';
  const form=node('form','copilot-composer');const input=document.createElement('textarea');input.rows=5;input.maxLength=8000;input.placeholder='Ask about this step, your strategy, leads, signals or setup…';input.setAttribute('aria-label','Message Ask LeadIntel');const send=node('button','copilot-send','Send');send.type='submit';form.append(input,send);
  const status=node('div','copilot-status');status.dataset.copilotStatus='';status.setAttribute('aria-live','polite');form.addEventListener('submit',async event=>{event.preventDefault();const message=input.value.trim();if(!message||pending)return;input.value='';await sendMessage(message);});
  for(const type of ['drop','paste'])drawer.addEventListener(type,event=>{if((event.dataTransfer?.files?.length||event.clipboardData?.files?.length)){event.preventDefault();setStatus('Please describe the problem in text.');}});drawer.addEventListener('dragover',event=>event.preventDefault());
  drawer.append(header,intro,messages,proposals,status,form);document.documentElement.appendChild(drawer);document.addEventListener('keydown',onKeydown);return drawer;
}

function renderSources(host,sources=[]){const safe=(Array.isArray(sources)?sources:[]).filter(item=>safeUrl(item?.url)).slice(0,8);if(!safe.length)return;const wrap=node('div','copilot-sources');wrap.append(node('strong','','Sources'));for(const [index,item] of safe.entries()){const link=node('a','copilot-source',`[${index+1}] ${item.title||item.url}`);link.href=safeUrl(item.url);link.target='_blank';link.rel='noopener noreferrer';const row=node('div');row.append(link);if(item.date)row.append(node('small','copilot-source-date',' · '+item.date));wrap.appendChild(row);}host.appendChild(wrap);}
function readableAnswer(text,sources){return String(text||'').replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,(_match,label,url)=>sources.some(source=>safeUrl(source.url)===safeUrl(url))?`[${label}]`:'[unverified link]').replace(/\*\*([^*]+)\*\*/g,'$1');}
function appendMessage(role,text,sources=[]){const host=drawer.querySelector('[data-copilot-messages]');const card=node('article',`copilot-message is-${role}`);card.append(node('span','copilot-message-role',role==='user'?'You':'LeadIntel'),node('p','copilot-message-text',role==='assistant'?readableAnswer(text,sources):text));renderSources(card,sources);host.appendChild(card);host.scrollTop=host.scrollHeight;}
function setStatus(text){drawer.querySelector('[data-copilot-status]').textContent=String(text||'');}

function renderProposals(){const host=drawer.querySelector('[data-copilot-proposals]');clear(host);}

async function sendMessage(message){
 if(pending)return;pending=true;const scope=workspaceId(),screen=deps.context.currentCopilotScreenContext(),api=deps.api;const send=drawer.querySelector('.copilot-send');send.disabled=true;appendMessage('user',message);setStatus('Thinking…');
 try{const result=await api.sendCopilotMessage({...(conversationId?{conversation_id:conversationId}:{}),message,screen},{onProgress:progress=>{if(scope!==workspaceId())return;const labels={thinking:'Thinking…',researching:'Researching public sources…',verifying:'Checking facts and following up…',answering:'Preparing your answer…'};if(labels[progress.phase])setStatus(labels[progress.phase]);}});if(scope!==workspaceId())return;if(!result){setStatus('Sign in to use Ask LeadIntel.');return;}conversationId=String(result.conversation_id||conversationId);appendMessage('assistant',result.answer||'No answer was returned.',result.sources||[]);renderProposals();setStatus(result.research_status==='incomplete'?'Some facts could not be verified.':result.research_used?'Answer includes external research.':'');}catch(cause){if(scope===workspaceId())setStatus(cause?.name==='AbortError'?'Ask LeadIntel timed out. Please try again.':cause?.message||'Ask LeadIntel is temporarily unavailable.');}finally{pending=false;send.disabled=false;}
}

export async function openCopilot(options={}){deps=options;const panel=ensureDrawer();if(conversationWorkspace!==workspaceId()){conversationWorkspace=workspaceId();conversationId='';clear(panel.querySelector('[data-copilot-messages]'));}panel.hidden=false;setStatus('Loading assistant…');try{const freshness=copilotWorkspaceSaveState();if(!freshness.current){setStatus('Save your workspace, then reopen Ask LeadIntel to use the latest context.');panel.querySelector('textarea')?.focus();return panel;}const boot=await deps.api.bootstrapCopilot();if(!boot){setStatus('Sign in to use Ask LeadIntel.');return panel;}conversationId=String(boot.latestConversation?.id||'');setStatus(boot.ai?.configured?'':'Basic guidance is available. Connect an AI provider in Settings for deeper reasoning.');}catch(cause){setStatus(cause?.message||'Copilot guidance is temporarily unavailable.');}panel.querySelector('textarea')?.focus();return panel;}

export {safeUrl,closeCopilot};
if(typeof window!=='undefined')window.LeadIntelCopilotUi={openCopilot,closeCopilot};
