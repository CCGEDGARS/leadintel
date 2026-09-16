const assert=require("node:assert/strict");
const isolation=require("../customer/workspace-isolation.js");

function storage(initial={}){
  const values=new Map(Object.entries(initial).map(([key,value])=>[key,JSON.stringify(value)]));
  return {
    getItem(key){return values.has(key)?values.get(key):null;},
    setItem(key,value){values.set(key,typeof value==="string"?value:JSON.stringify(value));},
    removeItem(key){values.delete(key);},
    has(key){return values.has(key);}
  };
}

const main={
  website:"https://www.ajprodukti.lv/",
  targetMarkets:["Latvia"],
  profile:{companyName:"AJ Produkti"},
  approved:true,
  market:{strategyApproved:true}
};

const legacy=storage({
  leadintel_customer_v2_discovery:{pipeline:[{domain:"old-company.example"}]},
  leadintel_customer_v2_outreach:{selectedDomain:"old-company.example",items:[{domain:"old-company.example",dossier:{}}]},
  leadintel_customer_v2_delivery:{items:[{domain:"old-company.example"}]}
});
const cleared=isolation.reconcileLocalWorkspace(legacy,main);
assert.equal(cleared.cleared,true,"legacy downstream data must be cleared for a new website");
assert.equal(legacy.getItem("leadintel_customer_v2_discovery"),null);
assert.equal(legacy.getItem("leadintel_customer_v2_outreach"),null);
assert.equal(legacy.getItem("leadintel_customer_v2_delivery"),null);

const sameWebsite=storage({
  leadintel_customer_v2_discovery:{pipeline:[{domain:"current-prospect.example"}]},
  leadintel_customer_v2_discovery_meta:{fingerprint:JSON.stringify({website:"https://ajprodukti.lv"})}
});
assert.equal(isolation.reconcileLocalWorkspace(sameWebsite,main).cleared,false,"current website pipeline must survive reload");

const mismatched=storage({
  leadintel_customer_v2_discovery:{pipeline:[{domain:"old-prospect.example"}]},
  leadintel_customer_v2_discovery_meta:{fingerprint:JSON.stringify({website:"https://ccgroup.lv"})}
});
assert.equal(isolation.reconcileLocalWorkspace(mismatched,main).cleared,true,"a different website must clear downstream data");

const noPipeline=storage();
assert.equal(isolation.safeStep(noPipeline,main,6),5,"Campaign Studio must wait for a current pipeline company");
noPipeline.setItem("leadintel_customer_v2_discovery",{pipeline:[{domain:"current-prospect.example"}]});
assert.equal(isolation.safeStep(noPipeline,main,6),6,"a saved pipeline company unlocks Campaign Studio");
assert.equal(isolation.safeStep(noPipeline,main,7),6,"Delivery must wait for outreach content");
noPipeline.setItem("leadintel_customer_v2_outreach",{items:[{domain:"current-prospect.example",dossier:{email:"draft"}}]});
assert.equal(isolation.safeStep(noPipeline,main,7),7,"outreach content unlocks Delivery");

console.log("workspace isolation and stage gating: PASS");
