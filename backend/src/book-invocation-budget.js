// D1's paid invocation allowance is shared by all cron tasks and storage
// accounting. Count conservatively at prepare time, including batched SQL.
export function withBookInvocationBudget(env){
 if(env.bookInvocationBudget)return env;
 const budget={used:0,reserved:0,hasRoom(cost){return this.used+this.reserved+cost<=700;},admit(cost){if(!this.hasRoom(cost))return false;this.reserved+=cost;return true;},release(cost){this.reserved=Math.max(0,this.reserved-cost);}};
 const DB=new Proxy(env.DB,{get(target,key){if(key==='prepare')return sql=>{budget.used++;return target.prepare(sql);};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});
 // Leave 300 statements for outstanding calls, finalization, quota recovery
 // and bounded company-material/language work sharing the same invocation.
 return {...env,DB,bookInvocationBudget:budget};
}
