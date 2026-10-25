// Settings drawer tabs (2026-10-25, CTO: "everything here matters, but split it so it stops overwhelming").
// The drawer keeps its head, readiness and engine summary on top; the sections below are grouped into
// horizontal tabs and only the chosen group is shown. Sections are recognised by their eyebrow text, so the
// existing renderers keep building the drawer exactly as before.
(function(root){
  'use strict';
  const TABS=Object.freeze([
    Object.freeze({id:'engines',label:'AI engines',match:['ai providers']}),
    Object.freeze({id:'data',label:'Data sources',match:['data & intelligence','data &amp; intelligence']}),
    Object.freeze({id:'delivery',label:'Delivery',match:['communication','meetings']}),
    Object.freeze({id:'profile',label:'Profile',match:['your professional profile']}),
    Object.freeze({id:'storage',label:'Storage',match:['your workspace']})
  ]);
  const STORAGE_KEY='leadintel_settings_tab';
  function sectionsOf(drawer){return Array.from(drawer.children).filter(el=>el.tagName==='SECTION');}
  function labelOf(section){return String(section.querySelector('.eyebrow')?.textContent||'').trim().toLowerCase();}
  function tabFor(section){
    if(section.id==='workspace-storage-card')return 'storage';
    const label=labelOf(section);
    for(const tab of TABS)if(tab.match.some(needle=>label.includes(needle)))return tab.id;
    return 'engines';
  }
  function rememberedTab(){try{const saved=root.localStorage?.getItem(STORAGE_KEY);return TABS.some(tab=>tab.id===saved)?saved:'';}catch{return '';}}
  function ensureCss(){if(document.querySelector('link[data-leadintel-asset="settings-tabs-css"]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href='./settings-tabs.css?v=20261025-v7';link.dataset.leadintelAsset='settings-tabs-css';document.head.appendChild(link);}
  function select(drawer,id,persist){
    const known=TABS.some(tab=>tab.id===id)?id:'engines';
    // Hidden state lives in a data attribute: renderers that reset className (the storage card does) cannot drop it.
    for(const section of sectionsOf(drawer)){const hide=(section.dataset.settingsTab||'engines')!==known;if(hide)section.setAttribute('data-settings-hidden','1');else section.removeAttribute('data-settings-hidden');}
    for(const button of drawer.querySelectorAll('.settings-tabs [data-settings-tab]')){const on=button.dataset.settingsTab===known;button.setAttribute('aria-selected',String(on));button.tabIndex=on?0:-1;}
    if(persist){try{root.localStorage?.setItem(STORAGE_KEY,known);}catch{}}
    return known;
  }
  function build(drawer){
    const sections=sectionsOf(drawer);if(sections.length<2)return null;
    for(const section of sections)section.dataset.settingsTab=tabFor(section);
    let bar=drawer.querySelector('.settings-tabs');
    if(!bar){
      ensureCss();
      bar=document.createElement('div');bar.className='settings-tabs';bar.setAttribute('role','tablist');bar.setAttribute('aria-label','Settings sections');
      for(const tab of TABS){const button=document.createElement('button');button.type='button';button.className='settings-tab';button.id='settings-tab-'+tab.id;button.setAttribute('role','tab');button.dataset.settingsTab=tab.id;button.textContent=tab.label;bar.appendChild(button);}
      sections[0].before(bar);
      bar.addEventListener('click',event=>{const button=event.target.closest('[data-settings-tab]');if(button)select(drawer,button.dataset.settingsTab,true);});
      bar.addEventListener('keydown',event=>{
        if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
        const buttons=Array.from(bar.querySelectorAll('[data-settings-tab]:not([hidden])'));const index=buttons.findIndex(button=>button.getAttribute('aria-selected')==='true');
        const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
        event.preventDefault();select(drawer,buttons[next].dataset.settingsTab,true);buttons[next].focus();
      });
    }
    // Renderers replace whole sections after status refreshes (the storage card after /storage/status). A replaced
    // section arrives untagged, so watch the drawer's children and re-apply the current tab in the next frame.
    if(!drawer.dataset.settingsTabsObserved&&typeof root.MutationObserver==='function'){
      drawer.dataset.settingsTabsObserved='1';let queued=false;
      new root.MutationObserver(records=>{if(queued||!records.some(record=>record.addedNodes.length))return;queued=true;const run=()=>{queued=false;build(drawer);};if(typeof root.requestAnimationFrame==='function')root.requestAnimationFrame(run);else root.setTimeout(run,0);}).observe(drawer,{childList:true});
    }
    // A tab without a section (for example storage hidden for this workspace) is not offered.
    const present=new Set(sections.map(section=>section.dataset.settingsTab));
    for(const button of bar.querySelectorAll('[data-settings-tab]'))button.hidden=!present.has(button.dataset.settingsTab);
    const current=bar.querySelector('.settings-tab[aria-selected="true"]:not([hidden])')?.dataset.settingsTab;
    return select(drawer,current||rememberedTab()||'engines',false);
  }
  root.LeadIntelSettingsTabs={build,select,tabFor,TABS,STORAGE_KEY};
  if(typeof root.addEventListener==='function')root.addEventListener('leadintel:settings-opened',()=>{const drawer=document.getElementById('ai-settings-drawer');if(drawer)build(drawer);});
})(typeof window==='object'?window:globalThis);
