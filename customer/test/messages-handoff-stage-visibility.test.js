const test=require('node:test');
const assert=require('node:assert/strict');
const next=require('../workflow-next-action.js');

function doc(){
  const footer={hidden:false};
  const gate={textContent:'',disabled:false,dataset:{},attrs:{},closest:()=>footer,setAttribute(k,v){this.attrs[k]=v;}};
  const pipeline={hidden:false};
  return {gate,footer,pipeline,document:{querySelector:s=>s==='.pipeline-panel'?pipeline:null,getElementById:id=>id==='continue-to-outreach'?gate:null}};
}

test('Messages handoff is hidden on Companies even when an old buyer exists',()=>{
  const x=doc();
  next.applyStageVisibility(x.document,5,{pipelineCount:1,buyerCount:1,focus:'companies'});
  assert.equal(x.footer.hidden,true);
  assert.equal(x.gate.disabled,true);
});

test('Messages handoff appears only on Buyers when at least one buyer exists',()=>{
  const x=doc();
  const action=next.applyStageVisibility(x.document,5,{pipelineCount:1,buyerCount:1,focus:'buyers'});
  assert.equal(x.footer.hidden,false);
  assert.equal(x.gate.disabled,false);
  assert.equal(action.label,'Continue to Messages →');
  assert.equal(x.gate.dataset.journeyStage,'6');
});

test('Buyers without identified people does not show a premature footer',()=>{
  const x=doc();
  next.applyStageVisibility(x.document,5,{pipelineCount:1,buyerCount:0,focus:'buyers'});
  assert.equal(x.footer.hidden,true);
  assert.equal(x.gate.disabled,true);
});
