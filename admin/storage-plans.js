(async function(){
 'use strict';
 await window.LeadIntelAdmin.ready;
 if(document.getElementById('admin-app').hidden)return;
 const element=id=>document.getElementById('storage-'+id);
 const form=element('editor'),fields=form.elements,select=element('scope'),status=element('status');
 const units={included_records_limit:1e6,included_files_limit:1e9,plus_records_limit:1e6,plus_files_limit:1e9};
 const endpoint='/api/access/storage-plans';
 let model=null,requestNumber=0,saving=false;
 const url=workspace=>workspace?endpoint+'?workspace='+encodeURIComponent(workspace):endpoint;
 function lock(locked){
  form.querySelector('fieldset').disabled=locked;
  element('save').disabled=locked;
  element('reset').disabled=locked;
  select.disabled=saving;
  element('reload').disabled=saving;
 }
 async function load(workspace,notice=''){
  const serial=++requestNumber;
  model=null;lock(true);status.textContent='Loading storage settings…';
  try{
   const response=await fetch(url(workspace),{credentials:'include',cache:'no-store'});
   const data=await response.json();
   if(serial!==requestNumber)return;
   if(!response.ok)throw Error(data.error||'Could not load storage settings.');
   model=data;
   select.replaceChildren(new Option('Standard plans · all workspaces using defaults',''),
    ...data.workspaces.map(row=>new Option(row.name+' ('+row.id+')',row.id)));
   select.value=workspace;
   const row=data.selected||data.settings;
   for(const [key,unit] of Object.entries(units))fields[key].value=row[key]/unit;
   fields.monthly_amount_minor.value=data.settings.monthly_amount_minor===null?'':data.settings.monthly_amount_minor/100;
   fields.monthly_amount_minor.disabled=Boolean(workspace);
   element('price').hidden=Boolean(workspace);
   element('context').textContent=workspace?
    (row.limits_overridden?'Custom limits. ':'Using standard limits. ')+(row.records_bytes/1e6).toFixed(2)+' MB of CRM data and '+(row.files_bytes/1e9).toFixed(3)+' GB of files in use.':
    'Standard limits apply to workspaces without an override. The monthly price applies to new subscriptions. Leave it blank to use the configured Stripe price.';
   element('save').textContent=workspace?'Save workspace limits':'Save standard plans';
   element('reset').hidden=!row.limits_overridden;
   lock(false);status.textContent=notice;
  }catch(error){if(serial===requestNumber)status.textContent=error.message;}
 }
 async function save(reset){
  if(!model||saving)return;
  const workspace=select.value,row=model.selected,body={action:reset?'reset':'save',revision:model.settings.revision};
  if(workspace)body.limits_revision=row.limits_revision;
  if(!reset){
   if(!form.reportValidity())return;
   for(const [key,unit] of Object.entries(units))body[key]=Math.round(fields[key].valueAsNumber*unit);
   if(body.plus_records_limit<body.included_records_limit||body.plus_files_limit<body.included_files_limit){
    status.textContent='Each Plus allowance must cover the corresponding Included allowance.';return;
   }
   if(!workspace)body.monthly_amount_minor=fields.monthly_amount_minor.value===''?null:Math.round(fields.monthly_amount_minor.valueAsNumber*100);
  }
  saving=true;lock(true);
  const scope=workspace?select.selectedOptions[0].textContent:'all workspaces using standard limits';
  try{
   const confirmed=await window.LeadIntelDialogs.confirm('Apply '+(reset?'standard limits':'these changes')+' to '+scope+'? If usage exceeds a new limit, existing data stays readable and new growth pauses.',{title:'Confirm storage changes',action:'Apply changes'});
   if(!confirmed)return;
   const response=await fetch(url(workspace),{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'Could not save storage settings.');
   await load(workspace,'Storage settings saved.');
  }catch(error){status.textContent=error.message;}
  finally{saving=false;lock(!model);}
 }
 select.addEventListener('change',()=>load(select.value));
 element('reload').addEventListener('click',()=>load(select.value));
 form.addEventListener('submit',event=>{event.preventDefault();save(false);});
 element('reset').addEventListener('click',()=>save(true));
 await load(new URLSearchParams(location.search).get('workspace')||'');
})();
