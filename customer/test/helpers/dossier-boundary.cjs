// Existing journey tests isolate their older provider/contact boundary. The real
// dossier boundary and evidence contract have dedicated integration coverage.
const D=require('../../company-dossier.js');
module.exports=function install(context){require('./strategy-discovery-context.cjs')(context);const w=context.window||(context.window=context);w.LeadIntelCompanyDossier=D;w.LeadIntelCompanyDossierUi={render:()=>'',evidenceRows:()=>[],research:async()=>({version:D.VERSION,status:'complete',people:[],facts:[],channels:[],sources:[],passes:[]})};return context;};
