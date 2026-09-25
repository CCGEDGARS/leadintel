const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');
const NextAction=require('../workflow-next-action.js');

test('Companies routes through Buyers before Messages',()=>{
  assert.deepEqual(NextAction.forStage(5,{pipelineCount:0}),{label:'Save a Company First',enabled:false,visible:false,journeyStage:5});
  assert.deepEqual(NextAction.forStage(5,{pipelineCount:1,buyerCount:0}),{label:'Continue to Buyers →',enabled:true,visible:true,journeyStage:5});
  assert.deepEqual(NextAction.forStage(5,{pipelineCount:1,buyerCount:1}),{label:'Continue to Messages →',enabled:true,visible:true,journeyStage:6});
});

test('Messages blocks Delivery until one message package is approved',()=>{
  assert.deepEqual(NextAction.forStage(6,{approvedCampaignCount:0}),{label:'Approve a Message First',enabled:false});
  assert.deepEqual(NextAction.forStage(6,{approvedCampaignCount:1}),{label:'Continue to Delivery →',enabled:true});
});

test('Delivery footer explains the remaining action and ends with a completion state',()=>{
  assert.deepEqual(NextAction.forStage(7,{approvedCampaignCount:0}),{label:'Approve a Message First',enabled:false});
  assert.deepEqual(NextAction.forStage(7,{approvedCampaignCount:1,sent:false}),{label:'Send an Approved Message First',enabled:false});
  assert.deepEqual(NextAction.forStage(7,{approvedCampaignCount:1,sent:true,outcome:false}),{label:'Record the Outcome',enabled:false});
  assert.deepEqual(NextAction.forStage(7,{approvedCampaignCount:1,sent:true,outcome:true}),{label:'Workflow Complete ✓',enabled:false});
});


test('Step 5 hides the empty pipeline and continuation control until an opportunity is saved',()=>{
  assert.equal(typeof NextAction.applyStageVisibility,'function');

  const pipeline={hidden:false};
  const footer={hidden:false};
  const gate={dataset:{},textContent:'Save a Company First',disabled:false,attributes:{},setAttribute(name,value){this.attributes[name]=value;},closest:()=>footer};
  const document={
    querySelector(selector){return selector==='.pipeline-panel'?pipeline:null;},
    getElementById(id){return id==='continue-to-outreach'?gate:null;}
  };

  NextAction.applyStageVisibility(document,5,{pipelineCount:0,buyerCount:0});
  assert.equal(pipeline.hidden,true);
  assert.equal(footer.hidden,true);
  assert.equal(gate.textContent,'Save a Company First');
  assert.equal(gate.disabled,true);
  assert.equal(gate.attributes['aria-disabled'],'true');

  NextAction.applyStageVisibility(document,5,{pipelineCount:1,buyerCount:0});
  assert.equal(pipeline.hidden,false);
  assert.equal(footer.hidden,false);
  assert.equal(gate.textContent,'Continue to Buyers →');
  assert.equal(gate.disabled,false);
  assert.equal(gate.attributes['aria-disabled'],'false');
  assert.equal(gate.dataset.journeyStage,'5');
  NextAction.applyStageVisibility(document,5,{pipelineCount:1,buyerCount:1});
  assert.equal(gate.textContent,'Continue to Messages →');
  assert.equal(gate.dataset.journeyStage,'6');
});

test('Buyers keeps saved companies visible and only offers Messages after a buyer is found',()=>{
  const pipeline={hidden:true};
  const footer={hidden:false};
  const gate={dataset:{},disabled:false,textContent:'',attributes:{},setAttribute(name,value){this.attributes[name]=value;},closest:()=>footer};
  const document={
    querySelector(selector){return selector==='.pipeline-panel'?pipeline:null;},
    getElementById(id){return id==='continue-to-outreach'?gate:null;}
  };

  NextAction.applyStageVisibility(document,5,{pipelineCount:1,buyerCount:0,focus:'buyers'});
  assert.equal(pipeline.hidden,false);
  assert.equal(footer.hidden,true);
  assert.equal(gate.textContent,'Continue to Buyers →');
  assert.equal(gate.disabled,true);
  assert.equal(gate.attributes['aria-disabled'],'true');

  NextAction.applyStageVisibility(document,5,{pipelineCount:1,buyerCount:1,focus:'buyers'});
  assert.equal(footer.hidden,false);
  assert.equal(gate.textContent,'Continue to Messages →');
  assert.equal(gate.disabled,false);
  assert.equal(gate.attributes['aria-disabled'],'false');
  assert.equal(gate.dataset.journeyStage,'6');
});


test('the workflow footer CSS respects the hidden state',()=>{
  const css=fs.readFileSync(path.join(__dirname,'..','styles.css'),'utf8');
  assert.match(css,/\.workflow-next-action\[hidden\]\s*\{\s*display:none!important\s*\}/);
});
