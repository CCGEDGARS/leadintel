// Research is stored verbatim. Only the reading view uses translated strings.
(function(root){
  'use strict';
  let language='en',scheduled=false;
  const pending=new Set(),results=new Map();
  const observer=root.IntersectionObserver&&new root.IntersectionObserver(entries=>{
    for(const entry of entries)entry.target.readingVisible=entry.isIntersecting;
    schedule();
  },{rootMargin:'120px'});
  function workspace(){
    const bridge=root.LeadIntelServerBridge;
    return bridge?.session?.authenticated?String(bridge.workspace?.id||''):'';
  }
  const regionNames=new Intl.DisplayNames(['en'],{type:'region'});
  const languageNames=new Intl.DisplayNames(['en'],{type:'language'});
  const regions=new Map();
  function localChoices(country,catalogue){
    const choices=catalogue.resolveCountry(country).choices;
    if(choices?.length)return choices;
    if(!regions.size){
      for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){
        const code=String.fromCharCode(a,b),name=regionNames.of(code);
        if(name&&name!==code)regions.set(name,code);
      }
    }
    const region=regions.get(country);
    return region?[new Intl.Locale('und-'+region).maximize().language]:[];
  }
  function choices(markets){
    const catalogue=root.LeadIntelLanguagePackCatalogue;
    return [...new Set(['en',...(markets||[]).flatMap(country=>localChoices(country,catalogue))])];
  }
  function schedule(){
    if(scheduled)return;
    scheduled=true;
    queueMicrotask(()=>{scheduled=false;void translateVisible();});
  }
  function configure(markets,preferred){
    const options=choices(markets);
    language=options.includes(preferred)?preferred:'en';
    const select=root.document.getElementById('research-results-language');
    if(select){
      select.replaceChildren(...options.map(code=>new Option(root.LeadIntelLanguagePackCatalogue.languages[code]||languageNames.of(code),code)));
      select.value=language;
    }
    schedule();
    return language;
  }
  function show(node,source,result){
    node.textContent=result?.text||source;
    if(result?.text===source)return;
    if(!result){node.append(' · Translating…');return;}
    const button=root.document.createElement('button');
    button.type='button';button.className='secondary-btn small';
    if(result.error){
      button.textContent='Retry translation';button.title=result.error;
      button.onclick=()=>{results.delete(node.readingKey);schedule();};
    }else{
      let original=false;
      button.textContent='View original';
      button.onclick=()=>{
        original=!original;
        node.firstChild.textContent=original?source:result.text;
        button.textContent=original?'View translation':'View original';
      };
    }
    node.append(' ',button);
  }
  async function translateVisible(){
    const id=workspace(),target=language;
    if(!id||!root.LeadIntelContentLanguage)return;
    const groups=new Map();
    for(const node of root.document.querySelectorAll('research-reading')){
      if(observer&&!node.readingVisible||node.workspaceId&&node.workspaceId!==id)continue;
      node.workspaceId=id;
      const source=node.originalText??=node.textContent.trim();
      if(!source)continue;
      const key=JSON.stringify([id,target,source]);
      if(node.readingKey!==key||!node.renderedResult||node.renderedResult!==results.get(key)){
        node.readingKey=key;
        node.renderedResult=results.get(key);
        show(node,source,node.renderedResult);
      }
      if(!results.has(key)&&!pending.has(key))groups.set(key,source);
    }
    const entries=[...groups];
    for(const [key] of entries)pending.add(key);
    for(let i=0;i<entries.length;i+=6){
      const batch=entries.slice(i,i+6);
      try{
        if(id!==workspace()||target!==language)continue;
        const input=Object.fromEntries(batch.map(([,source],idx)=>['field'+idx,source]));
        const translated=await root.LeadIntelContentLanguage.request(root,id,target,input);
        batch.forEach(([key],idx)=>results.set(key,{text:translated['field'+idx]}));
      }catch(error){for(const [key] of batch)results.set(key,{error:error.message||'Translation unavailable'});}
      finally{for(const [key] of batch)pending.delete(key);}
      schedule();
    }
  }
  root.LeadIntelResearchReading={configure,choices};
  if(root.customElements&&!root.customElements.get('research-reading')){
    root.customElements.define('research-reading',class extends root.HTMLElement{
      connectedCallback(){observer?.observe(this);schedule();}
      disconnectedCallback(){observer?.unobserve(this);}
    });
  }
  root.addEventListener('leadintel:server-ready',schedule);
})(window);
