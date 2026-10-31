const fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const D=require('../../discovery-engine.js'),Crm=require('../../crm-engine.js'),Policy=require('../../contact-confirmation-policy.js');
const source=fs.readFileSync(require.resolve('../../discovery-ui.js'),'utf8').replace(/\ninitDiscoveryWhenReady\(\);\s*$/,'');
exports.runtime=function(){
 const dom=new JSDOM('<div id="customer-pipeline"></div><div id="company-candidates"></div><div id="discovery-potential-matches"></div>',{url:'https://controls.audit.example/'}),storage=new Map(),calls=[];
 const person={id:'person-a',name:'Avery Buyer',publicName:'Avery Buyer',title:'Procurement Director',organization:'Example',publicNameUrl:'https://example.com/team'},other={...person,id:'person-b',name:'Blair Buyer',publicName:'Blair Buyer'};
 const candidate={company:'Example',domain:'example.com',crmId:'company',buyerSearchMode:'user_selected_target',people:[person,other],buyerRoles:'Procurement Director',buyerDiscovery:{pool:[]}};
 const b={workspace:{id:'w',role:'owner'},session:{authenticated:true,user:{id:'u'}},saveNow:async()=>({saved:true}),recordCrmActivity:async()=>({ok:true})};
 const c={console,URL,AbortController,AbortSignal,CustomEvent:dom.window.CustomEvent,setTimeout,clearTimeout,setInterval,clearInterval,document:dom.window.document,LeadIntelDiscovery:{...D,qualifyBuyer:()=>({eligible:true,gaps:[]})},LeadIntelCrm:Crm,LeadIntelContactPolicy:Policy,LeadIntelServerBridge:b,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},addEventListener(){},dispatchEvent:event=>calls.push(event)};c.window=c;c.LeadIntelAdditionalContacts={register:hooks=>c.paidHooks=hooks};vm.createContext(c);vm.runInContext(source,c);
 Object.assign(c,{renderAll(){},renderPipeline(){},renderCandidates(){},renderSelectedEmailBuyer(){},showToast:m=>calls.push(String(m)),saveDiscovery(){},refreshCrmState:async()=>true,ensureCrmCompany:async()=>({id:'company'})});
 c.fixture={candidates:[candidate],selectedProspects:[candidate],pipeline:[],potentialMatches:[]};vm.runInContext('discovery=fixture;crmCompanies=[{id:"company",normalized_domain:"example.com"}];',c);
 const r={c,b,person,other,candidate,dom,calls,storage,eval:code=>vm.runInContext(code,c),close:()=>dom.window.close()};
 r.contact=(patch={})=>({id:'contact-a',company_id:'company',workspace_id:'w',external_person_id:person.id,name:person.name,title:person.title,work_email:'avery@example.com',normalized_email:'avery@example.com',email_status:'verified',verification_provider:'treg',source:'treg',...patch});
 r.detail=(contacts)=>({ok:true,company:{id:'company',workspace_id:'w',normalized_domain:'example.com',lifecycle_status:'prospect'},contacts});
 r.seed=contact=>{c.seedContact=contact;r.eval('enrichmentResults.set("example.com|person-a",{contact:seedContact})');return contact;};
 return r;
};
exports.gate=function(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
