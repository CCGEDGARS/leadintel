const assert=require("node:assert/strict");
const activation=require("./website-activation.js");

const previous={
  website:"https://ccgroup.lv/",
  targetMarkets:["Sweden"],
  additionalLinks:["https://ccgroup.lv/services"],
  documents:[{name:"ccgroup.pdf",text:"Sales training"}],
  answers:{priority_offers:"Sales training"},
  answerStatus:{priority_offers:"user"},
  profile:{companyName:"CCGROUP"},
  approved:true,
  market:{icps:[{name:"Sales teams"}]}
};

const switched=activation.buildActivatedState(
  previous,
  {url:"https://ercon.lv/",title:"Ercon",text:"Ercon website evidence"},
  "2026-09-11T00:00:00.000Z"
);

assert.deepEqual(switched.answers,{},"old company answers must not cross domains");
assert.deepEqual(switched.answerStatus,{},"old answer provenance must not cross domains");
assert.deepEqual(switched.documents,[],"old company documents must not cross domains");
assert.deepEqual(switched.additionalLinks,[],"old company links must not cross domains");
assert.deepEqual(switched.targetMarkets,["Sweden"],"target market selection may be reused");

const reactivated=activation.buildActivatedState(
  {...previous,website:"https://ccgroup.lv/"},
  {url:"https://www.ccgroup.lv/",title:"CCGROUP",text:"Fresh CCGROUP evidence"},
  "2026-09-11T00:00:00.000Z"
);
assert.deepEqual(reactivated.answers,previous.answers,"same-domain reactivation preserves customer input");
assert.deepEqual(reactivated.documents,previous.documents,"same-domain reactivation preserves uploaded material");

console.log("website activation company-context isolation: PASS");
