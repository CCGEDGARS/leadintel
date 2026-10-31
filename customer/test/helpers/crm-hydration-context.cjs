const Crm=require('../../crm-engine.js');
const Dossier=require('../../company-dossier.js');
const installStrategyContext=require('./strategy-discovery-context.cjs');

// Use the shipping company restore and Strategy fingerprint in extracted Buyers
// hydration tests, with one stable authenticated workspace bridge.
module.exports=function install(context){
 context.window||=context;
 context.window.LeadIntelCrm=Crm;
 context.LeadIntelCompanyDossier=Dossier;
 const bridge={workspace:{id:'hydration-workspace'},session:{authenticated:true,user:{id:'hydration-user'}}};
 context.bridge||=()=>bridge;
 return installStrategyContext(context);
};
