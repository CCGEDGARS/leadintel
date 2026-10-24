(function(root){
  'use strict';
  const money=(micro,currency)=>typeof micro==='number'&&Number.isFinite(micro)?new Intl.NumberFormat('en',{style:'currency',currency:currency||'USD',minimumFractionDigits:2,maximumFractionDigits:6}).format(micro/1000000):'Unknown';
  function mount(host,options={}){
    if(!host||typeof options.request!=='function')throw new Error('Research costs require a host and authenticated request function.');
    let revision=0,destroyed=false;
    const document=host.ownerDocument;
    function node(tag,text,className){const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);if(className)el.className=className;return el;}
    function scope(){
      const value=typeof options.getWorkspace==='function'?options.getWorkspace():options.workspace;
      const session=typeof options.getSession==='function'?options.getSession():null;
      const id=session?.authenticated===false?'':String(typeof value==='string'?value:value?.id||'');
      const viewerId=String(value?.viewerId||session?.user?.id||'');
      return {id,key:JSON.stringify([id,viewerId])};
    }
    const panel=node('section',undefined,'research-costs');panel.setAttribute('aria-label','Research costs');
    const heading=node('div',undefined,'research-costs-heading'),title=node('h3','Research costs'),refresh=node('button','Refresh');refresh.type='button';heading.append(title,refresh);
    const form=node('form',undefined,'research-costs-period'),start=node('input'),end=node('input'),apply=node('button','View period');start.type=end.type='date';start.name='start';end.name='end';apply.type='submit';
    const now=new Date();start.value=now.toISOString().slice(0,7)+'-01';end.value=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1)).toISOString().slice(0,10);
    for(const [label,input] of [['From (UTC)',start],['Until (UTC, exclusive)',end]]){const wrap=node('label',label);wrap.append(input);form.append(wrap);}form.append(apply);
    const status=node('p','Loading recorded research costs…','research-costs-status');status.setAttribute('role','status');
    const content=node('div');panel.append(heading,form,status,content);host.replaceChildren(panel);
    function fact(parent,label,value){const item=node('div',undefined,'research-costs-fact');item.append(node('span',label),node('strong',value));parent.append(item);}
    function render(data){
      content.replaceChildren();
      const summary=node('div',undefined,'research-costs-summary');
      fact(summary,'Total research cost','Unknown · incomplete coverage');
      const spend=Array.isArray(data.confirmedSpend)?data.confirmedSpend:[];
      if(spend.length)for(const row of spend)fact(summary,'Recorded receipt spend ('+row.currency+')',money(row.amountMicro,row.currency));
      else fact(summary,'Recorded receipt spend','Unknown · no confirmed amount');
      const unit=data.costPerUsableContact||{};
      fact(summary,'Treg receipts per usable Treg contact',money(unit.amountMicro,unit.currency));
      fact(summary,'Newly verified usable Treg contacts',data.contacts?.newlyVerifiedTregUsable??'Unknown');
      content.append(summary,node('p',unit.coverage||'Cost per usable contact is unknown.','research-costs-note'));
      const limits=data.limits||{};
      content.append(node('p','Monetary budget: '+(data.monetaryBudget?.amount==null?'Not configured · saved limits count lookups, not money.':money(data.monetaryBudget.amount,data.monetaryBudget.currency)),'research-costs-note'));
      if(limits.status==='saved')content.append(node('p','Saved lookup limits: '+limits.dailyUsed+' / '+limits.dailyLimit+' today ('+limits.day+', UTC); '+limits.monthlyUsed+' / '+limits.monthlyLimit+' this month ('+limits.month+'); '+limits.maxPerCompany+' buyers per company. Paid email search '+(limits.enabled?'on':'off')+'.','research-costs-note'));
      else content.append(node('p',limits.coverage||'Saved lookup limits unavailable.','research-costs-note'));
      const table=node('table'),caption=node('caption','Provider coverage'),thead=node('thead'),head=node('tr');
      for(const label of ['Provider','Recorded amount','Coverage'])head.append(node('th',label));thead.append(head);table.append(caption,thead);
      const tbody=node('tbody');for(const provider of data.providers||[]){const tr=node('tr');tr.append(node('td',provider.provider),node('td',provider.confirmedAmountMicro!=null?money(provider.confirmedAmountMicro,provider.currency):'Unknown'));
        let detail=provider.coverage||'Cost not measured.';
        if(provider.recordedEvents!=null)detail+=' Saved events: '+provider.recordedEvents+'.';
        if(provider.inputTokens!=null||provider.outputTokens!=null)detail+=' Recorded tokens: '+(provider.inputTokens??'unknown')+' in / '+(provider.outputTokens??'unknown')+' out.';
        if(provider.confirmedReceipts!=null)detail+=' Confirmed receipts: '+provider.confirmedReceipts+'; unknown: '+(provider.unknownReceipts??'unknown')+'.';
        tr.append(node('td',detail));tbody.append(tr);
      }table.append(tbody);const scroll=node('div',undefined,'research-costs-table');scroll.append(table);content.append(scroll);
      for(const note of data.notes||[])content.append(node('p',note,'research-costs-note'));
      status.textContent='Incomplete cost coverage · '+String(data.period?.start||'').slice(0,10)+' to '+String(data.period?.end||'').slice(0,10)+' (UTC, end exclusive).';
    }
    async function load(){
      const ticket=++revision,context=scope(),id=context.id;content.replaceChildren();refresh.disabled=apply.disabled=false;
      if(destroyed)return;
      if(!id){status.textContent='Select a workspace to view research costs.';return;}
      if(!start.value||!end.value||start.value>=end.value){status.textContent='Choose a valid period; the end date is exclusive.';return;}
      refresh.disabled=apply.disabled=true;status.textContent='Loading recorded research costs…';
      try{
        const query=new URLSearchParams({workspace_id:id,start:start.value,end:end.value});
        let data=await options.request('/api/research/costs?'+query,{method:'GET'});
        if(data?.response&&Object.prototype.hasOwnProperty.call(data,'payload')){if(!data.response.ok)throw new Error('Records unavailable');data=data.payload;}
        if(data&&typeof data.json==='function'){if(!data.ok)throw new Error('Records unavailable');data=await data.json();}
        if(destroyed||ticket!==revision)return;
        if(context.key!==scope().key){content.replaceChildren();status.textContent='Workspace or account changed. Refresh to load its research costs.';return;}
        if(!data||data.error||data.workspaceId!==id)throw new Error('Records unavailable');
        render(data);
      }catch(error){if(!destroyed&&ticket===revision){content.replaceChildren();status.textContent='Research cost records are unavailable. Refresh to retry.';}}
      finally{if(!destroyed&&ticket===revision)refresh.disabled=apply.disabled=false;}
    }
    refresh.addEventListener('click',load);form.addEventListener('submit',event=>{event.preventDefault();load();});
    const onWorkspace=()=>{if(!destroyed)load();};root.addEventListener?.('leadintel:workspace-changed',onWorkspace);
    const ready=load();
    return {ready,refresh:load,destroy(){destroyed=true;revision++;root.removeEventListener?.('leadintel:workspace-changed',onWorkspace);if(panel.parentNode===host)panel.remove();}};
  }
  root.LeadIntelResearchCosts={mount,formatMoney:money};
})(typeof window!=='undefined'?window:globalThis);
