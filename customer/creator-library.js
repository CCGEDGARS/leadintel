(function(root){
'use strict';
function mount(document,{host,request,refresh,scope}){
 const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const panel=el('details');panel.id='creator-library';panel.className='cl-panel';panel.hidden=true;panel.append(el('summary','Creator Library'));
 const content=el('div'),notice=el('p');notice.setAttribute('role','status');panel.append(content,notice);host.before(panel);
 let allowed=false,unlocked=false,data=null,editing=null,dirty=false,busy=false,epoch=0,identity='',timer;
 const say=text=>notice.textContent=text;
 const button=(text,fn)=>{const b=el('button',text);b.type='button';b.className='secondary-btn';b.onclick=async()=>{if(busy)return;busy=true;b.disabled=true;const captured=epoch;try{await fn();}catch(e){if(captured===epoch)say(e.message);}finally{busy=false;if(b.isConnected)b.disabled=false;}};return b;};
 const confirm=text=>root.LeadIntelDialogs?.confirm(text)??Promise.resolve(false);
 async function load(){const captured=epoch,result=await request('/creator');if(captured!==epoch)return;data=result;unlocked=true;draw();}
 function clear(){epoch++;clearTimeout(timer);unlocked=false;data=null;editing=null;dirty=false;content.replaceChildren();panel.open=false;}
 async function lock(){if(dirty&&!await confirm('Discard the unsaved script changes and lock Creator Library?'))return;await request('/creator/lock',{method:'POST'});clear();draw();say('Creator Library locked.');}
 function input(label,value,{multiline=false,maxLength=12000}={}){const l=el('label',label),n=el(multiline?'textarea':'input');n.value=value||'';n.maxLength=maxLength;if(multiline)n.rows=9;n.addEventListener('input',()=>dirty=true);l.append(n);content.append(l);return n;}
 async function edit(row){if(dirty&&!await confirm('Discard the unsaved script changes?'))return;editing={...row};dirty=false;draw();}
 function draw(){
  content.replaceChildren();if(!allowed)return;
  if(!unlocked){
   content.append(el('p','Creator access only. Enter your creator password. Unless separately configured, use your platform owner sign-in password. Unlock lasts up to 15 minutes.'));
   const form=el('form'),label=el('label','Password'),password=el('input');password.type='password';password.autocomplete='current-password';password.required=true;password.maxLength=512;label.append(password);const submit=el('button','Unlock library');submit.className='primary-btn';submit.type='submit';form.append(label,submit);content.append(form);
   form.onsubmit=async event=>{event.preventDefault();if(busy)return;busy=true;submit.disabled=true;const captured=epoch;try{const result=await request('/creator/unlock',{method:'POST',body:{password:password.value}});password.value='';if(captured!==epoch)return;unlocked=true;timer=setTimeout(()=>{clear();draw();say('Unlock expired. Enter your password again.');},Math.max(1,result.expiresAt-Date.now()));await load();say('');}catch(e){password.value='';if(captured===epoch)say(e.message);}finally{busy=false;submit.disabled=false;}};return;
  }
  content.append(el('p','Private source drafts → review → activate a channel/style master. Active patterns are used for new script preparation. Existing customer drafts stay intact. Only {{field}} placeholders change; literal wording is preserved.'));
  const actions=el('div');actions.className='cl-actions';actions.append(button('New script',()=>edit({id:root.crypto.randomUUID(),revision:0,channel:'email',style:'professional',name:'',folder:'',subject:'',body:'',original:''})),button('Refresh',async()=>{if(dirty&&!await confirm('Discard unsaved changes and refresh?'))return;editing=null;dirty=false;await load();}),button('Lock library',lock));content.append(actions);
  if(editing){
   const row=editing;content.append(el('h3',row.revision?'Edit source · v'+row.revision:'New source script'));
   const name=input('Script title',row.name,{maxLength:80}),folder=input('Subfolder (optional)',row.folder,{maxLength:80});
   const select=(label,values,value)=>{const l=el('label',label),s=el('select');for(const [id,title] of values){const o=el('option',title);o.value=id;s.append(o);}s.value=value;s.onchange=()=>dirty=true;l.append(s);content.append(l);return s;};
   const channel=select('Folder',[['email','Emails'],['linkedin','Messages'],['phone','Phone Calls']],row.channel),style=select('Style',[['professional','Professional'],['curiosity','NLP'],['friendly','Friendly'],['brutal','Brutal Honesty'],['storyselling','Storyselling']],row.style);
   const original=input('Original script (preserved as supplied)',row.original,{multiline:true,maxLength:30000}),subject=input('Email subject pattern',row.subject,{maxLength:500}),body=input('Active script pattern',row.body,{multiline:true});
   const upload=el('input');upload.type='file';upload.accept='.txt,.md,text/plain,text/markdown';const uploadLabel=el('label','Import original from .txt or .md');uploadLabel.append(upload);content.append(uploadLabel);upload.onchange=async()=>{try{const file=upload.files[0];if(!file)return;if(file.size>120000)throw Error('Choose a text file up to 120 KB.');const text=await file.text();if(text.length>30000)throw Error('Original exceeds 30,000 characters.');original.value=text;dirty=true;}catch(e){say(e.message);}};
   content.append(el('p','Paste the original above. In the active pattern, replace changing facts with explicit fields such as {{firstName}}, {{buyerCompany}}, {{sender}}, {{company}}, {{offer}} and {{calendly}}. Unknown fields remain visible and prevent final use. No AI rewriting of masters.'));
   const review=el('label'),check=el('input');check.type='checkbox';review.append(check,document.createTextNode(' I reviewed the original, pattern, reusable fields and claims.'));content.append(review);
   const controls=el('div');controls.className='cl-actions';controls.append(button('Copy original to pattern',async()=>{if(body.value&&!await confirm('Replace the script pattern with the original text?'))return;body.value=original.value;dirty=true;}),button('Save draft',async()=>{if(!check.checked)throw Error('Review the script and tick the confirmation.');const captured=epoch;const result=await request('/creator/'+row.id,{method:'PUT',body:{name:name.value,folder:folder.value,channel:channel.value,style:style.value,original:original.value,subject:channel.value==='email'?subject.value:'',body:body.value,expectedRevision:row.revision}});if(captured!==epoch)return;editing=result.script;dirty=false;await load();say('Draft saved. Activate it below when ready.');}),button('Close editor',async()=>{if(dirty&&!await confirm('Discard unsaved script changes?'))return;editing=null;dirty=false;draw();}));content.append(controls);
  }
  for(const [channel,title] of [['email','Emails'],['linkedin','Messages'],['phone','Phone Calls']]){
   const section=el('details');section.open=true;section.append(el('summary',title));
   const scripts=(data?.scripts||[]).filter(r=>r.channel===channel&&!r.deleted),groups=[...new Set(scripts.map(r=>r.folder||'General'))].sort();
   if(!scripts.length)section.append(el('p','No source drafts yet. Add one manually or copy an existing master below.'));
   for(const group of groups){const sub=el('details');sub.open=true;sub.append(el('summary',group));for(const row of scripts.filter(r=>(r.folder||'General')===group)){
    const active=data.active.find(r=>r.id===row.channel+':'+row.style),isActive=!active?.deleted&&active?.creatorSource?.id===row.id&&active.creatorSource.revision===row.revision;
    const card=el('details');card.append(el('summary',row.name+' · v'+row.revision+(isActive?' · Active':' · Draft')));const pre=el('pre',row.original);card.append(pre);
    card.append(button('Edit',()=>edit(row)),button('Activate version',async()=>{if(dirty)throw Error('Save or close unsaved edits before activating.');if(!await confirm('Activate “'+row.name+'” v'+row.revision+' as the '+row.style+' master for '+title+'? New preparations will use it across LeadIntel. Existing drafts are preserved.'))return;await request('/creator/'+row.id+'/activate',{method:'POST',body:{expectedRevision:row.revision,expectedCoreRevision:active?.revision||0}});await load();await refresh();say('Version activated. Choose its style or Update message to use it. Existing drafts are unchanged.');}),button('Remove source draft',async()=>{if(!await confirm('Remove this source draft? Its history is retained. An activated master remains active until explicitly replaced.'))return;await request('/creator/'+row.id,{method:'DELETE',body:{expectedRevision:row.revision}});if(editing?.id===row.id){editing=null;dirty=false;}await load();}));
    if(row.history?.length){const history=el('details');history.append(el('summary','Version history'));for(const old of row.history.slice().reverse())history.append(button('Review v'+old.revision,()=>edit({...old,id:row.id,revision:row.revision,history:row.history})));card.append(history);}sub.append(card);
   }section.append(sub);}content.append(section);
  }
  const removed=el('details');removed.append(el('summary','Removed source drafts'));for(const row of data?.scripts||[]){if(!row.deleted)continue;removed.append(button('Restore '+row.name,async()=>{await request('/creator/'+row.id,{method:'PUT',body:{...row,expectedRevision:row.revision}});await load();say('Source draft restored. Activation remains separate.');}));}if(removed.childNodes.length>1)content.append(removed);
  const bundled=el('details');bundled.append(el('summary','Existing active masters'));for(const row of data?.active||[]){if(row.deleted||row.mode==='inmail')continue;bundled.append(button('Copy '+row.channel+' · '+row.name+' into source draft',()=>edit({...row,id:root.crypto.randomUUID(),revision:0,history:[],original:row.original||row.body,folder:'Imported masters'})));}content.append(bundled);
 }
 return {render(canManage){const next=scope();if(next!==identity){clear();identity=next;allowed=false;}allowed=Boolean(canManage);panel.hidden=!allowed;if(!allowed){clear();return;}if(!content.childNodes.length)draw();},destroy(){clear();panel.remove();}};
}
const api={mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.LeadIntelCreatorLibrary=api;
})(typeof window==='object'?window:globalThis);
