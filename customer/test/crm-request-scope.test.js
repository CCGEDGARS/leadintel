const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../server-bridge.js'),'utf8');
for(const change of ['workspace','workspace-object','account','bridge','signed-out','role'])test(`shared CRM request rejects a late result after ${change} change`,async()=>{
 let finish;const bridge={session:{authenticated:true,user:{id:'u1'}},workspace:{id:'w1',role:'owner'}},root={LeadIntelServerBridge:bridge};
 const ctx={bridge,root,URLSearchParams,api:()=>new Promise(resolve=>finish=resolve)};vm.createContext(ctx);
 vm.runInContext(source.slice(source.indexOf('function crmPath('),source.indexOf('async function listCrmCompanies(')),ctx);
 const pending=ctx.crmRequest('/companies');
 if(change==='workspace')bridge.workspace.id='w2';if(change==='workspace-object')bridge.workspace={...bridge.workspace};if(change==='account')bridge.session.user.id='u2';if(change==='bridge')root.LeadIntelServerBridge={...bridge};if(change==='signed-out')bridge.session.authenticated=false;if(change==='role')bridge.workspace.role='viewer';
 finish({response:{ok:true,status:200},payload:{companies:[{company_name:'Private old account'}]}});const result=await pending;
 assert.equal(result.ok,false);assert.equal(result.status,409);assert.equal(result.companies,undefined);
});
