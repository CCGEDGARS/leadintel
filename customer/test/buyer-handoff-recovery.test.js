const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function runtime({item=false,stage=6,conflict=false,ready=true}={}){
 const choice={workspaceId:'w1',domain:'buyer.example',personId:'robert',contactId:'contact-robert',channel:'email',email:'robert@buyer.example',recipientIdentity:{version:1,name:'Robert Lund'}};
 const values=new Map([['leadintel_customer_v2_discovery_meta',JSON.stringify({scriptBuyer:choice,...(stage===6?{pendingMessageHandoff:{version:1,choice}}:{}),activeJourneyStage:5,visibleStep:5})],['leadintel_customer_v2_outreach',JSON.stringify({items:item?[{domain:choice.domain,selectedPersonId:choice.personId,channel:'email',dossier:{},messageStudioDraft:{}}]:[]})]]),listeners={},timers=[],calls=[];
 const root={localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)},LeadIntelServerBridge:{ready,session:{authenticated:true,user:{id:'u1'}},workspace:{id:'w1'},conflict},LeadIntelDiscoveryUI:{resumeSavedMessageHandoff:async selected=>{calls.push(selected);return true;}},addEventListener:(name,fn)=>listeners[name]=fn,setTimeout:fn=>(timers.push(fn),timers.length),clearTimeout(){}};
 root.window=root;vm.runInNewContext(fs.readFileSync(require.resolve('../buyer-handoff-recovery.js'),'utf8'),root);
 return {root,choice,calls,listeners,timers,values};
}
test('a persisted unfulfilled exact recipient handoff resumes after authenticated reload only once',async()=>{
 const h=runtime();await new Promise(resolve=>setImmediate(resolve));assert.equal(h.calls.length,1);assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0])),h.choice);
 h.listeners['leadintel:server-ready']();await new Promise(resolve=>setImmediate(resolve));assert.equal(h.calls.length,1);
});
test('handoff recovery preserves selected-only, existing Messages, conflicts and signed-out contexts',async()=>{
 for(const options of [{stage:5},{item:true},{conflict:true},{ready:false}]){const h=runtime(options);await new Promise(resolve=>setImmediate(resolve));assert.equal(h.calls.length,0,JSON.stringify(options));}
 const h=runtime({ready:false});h.root.LeadIntelServerBridge.session.authenticated=false;h.root.LeadIntelServerBridge.ready=true;h.listeners['leadintel:server-ready']();await new Promise(resolve=>setImmediate(resolve));assert.equal(h.calls.length,0);
});
