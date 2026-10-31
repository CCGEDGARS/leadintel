const fs=require('node:fs'),D=require('../../discovery-engine.js');
const ui=fs.readFileSync(require.resolve('../../discovery-ui.js'),'utf8');
exports.source=ui.slice(ui.indexOf('const buyerActionPendingOwners='),ui.indexOf('function buyerRecipientIdentity('))+ui.slice(ui.indexOf('function validateBuyerProviderContact('),ui.indexOf('async function confirmBuyerContact('));
exports.prepare=function(ctx,candidate){
 ctx.discovery=ctx.discovery||{candidates:[candidate],selectedProspects:[],pipeline:[]};
 ctx.LeadIntelDiscovery={...D,...ctx.LeadIntelDiscovery};
 ctx.canonicalDomain=ctx.canonicalDomain||D.canonicalDomain;
 ctx.discoveryOperationContext=()=>JSON.stringify([ctx.bridge()?.workspace?.id||'',ctx.bridge()?.session?.user?.id||'',ctx.bridge()?.session?.authenticated]);
};
