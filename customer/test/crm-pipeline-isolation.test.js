const test=require("node:test");
const assert=require("node:assert/strict");
const {filterPipelineForWorkspace}=require("../workspace-isolation.js");

test("Discovery hides active CRM rows from another customer project",()=>{
  const crmPipeline=[
    {id:"old",normalized_domain:"mural.co",pipeline_stage:"Ready for Outreach"},
    {id:"current",normalized_domain:"prospect.lv",pipeline_stage:"Discovered"}
  ];
  assert.deepEqual(filterPipelineForWorkspace(crmPipeline,[{domain:"prospect.lv"}]),[crmPipeline[1]]);
  assert.deepEqual(filterPipelineForWorkspace(crmPipeline,[]),[]);
});

test("resets an existing pipeline that has no customer scope marker",()=>{
  const {pipelineScopeNeedsReset}=require("../workspace-isolation.js");
  assert.equal(
    pipelineScopeNeedsReset("https://www.ajprodukti.lv",{website:"https://www.ajprodukti.lv"},true),
    true
  );
  assert.equal(
    pipelineScopeNeedsReset(
      "https://www.ajprodukti.lv",
      {website:"https://www.ajprodukti.lv",pipelineWebsite:"https://www.ajprodukti.lv"},
      true
    ),
    false
  );
});
