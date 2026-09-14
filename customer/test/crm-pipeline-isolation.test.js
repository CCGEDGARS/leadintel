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
