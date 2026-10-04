(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.LeadIntelWorkspaceSync=api;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const object=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
  function equal(a,b){
    if(a===b)return true;
    if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>equal(v,b[i]));
    if(!object(a)||!object(b))return false;
    const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.prototype.hasOwnProperty.call(b,k)&&equal(a[k],b[k]));
  }
  function project(payload={}){return {main:payload.main||{},discovery:payload.discovery||{},outreach:payload.outreach||{},delivery:payload.delivery||{},meta:{discovery:payload.meta?.discovery||{}}};}
  function merge(base,local,server){
    const conflicts=[];
    function visit(b,l,r,path){
      if(equal(l,r))return l;
      if(equal(l,b))return r;
      if(equal(r,b))return l;
      // Arrays are indivisible: never guess which buyer, evidence, or deletion wins.
      if(object(b)&&object(l)&&object(r)){
        const output={};
        for(const key of new Set([...Object.keys(b),...Object.keys(l),...Object.keys(r)])){
          const value=visit(b[key],l[key],r[key],path?`${path}.${key}`:key);
          if(value!==undefined)Object.defineProperty(output,key,{value,enumerable:true,configurable:true,writable:true});
        }
        return output;
      }
      conflicts.push(path);return l;
    }
    const payload=visit(project(base),project(local),project(server),'');
    return {safe:conflicts.length===0,payload,conflicts};
  }
  return {equal,project,merge};
});
