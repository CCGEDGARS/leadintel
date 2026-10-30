const fs=require('node:fs');
const vm=require('node:vm');
const Integrity=require('../../strategy-integrity.js');
const source=fs.readFileSync(require.resolve('../../discovery-ui.js'),'utf8');
const helpers=source.slice(source.indexOf('function fingerprint('),source.indexOf('function sameStrategyFingerprint('));
const projection=source.slice(source.indexOf('function companyQualificationProfile('),source.indexOf('\n',source.indexOf('function companyQualificationProfile(')));
const roleParser=source.slice(source.indexOf('function roleList('),source.indexOf('function candidateBuyerRoles('));
const installed=new WeakSet();
module.exports=function install(context){
 if(installed.has(context))return context;
 installed.add(context);
 context.window||=context;
 context.window.LeadIntelStrategyIntegrity=Integrity;
 if(!context.localStorage){const storage=new Map();context.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)};}
 // Older extracted-function fixtures return a new bridge literal on each read.
 // Keep one bridge identity while its workspace/session still reflect the fixture's live values.
 if(context.bridge){let accessor;const replace=read=>{const bridge=new Proxy({}, {get:(_,key)=>read()?.[key]});accessor=()=>bridge;};replace(context.bridge);Object.defineProperty(context,'bridge',{configurable:true,get:()=>accessor,set:replace});}
 context.mainState||=()=>({profile:{}});
 vm.runInNewContext(helpers+'\n'+projection+'\n'+roleParser,context);
 return context;
};
