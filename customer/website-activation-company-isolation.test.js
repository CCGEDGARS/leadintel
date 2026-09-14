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

assert.deepEqual(JSON.parse(JSON.stringify(switched.answers)),{},"old company answers must not cross domains");
assert.deepEqual(JSON.parse(JSON.stringify(switched.answerStatus)),{},"old answer provenance must not cross domains");
assert.deepEqual(JSON.parse(JSON.stringify(switched.documents)),[],"old company documents must not cross domains");
assert.deepEqual(JSON.parse(JSON.stringify(switched.additionalLinks)),[],"old company links must not cross domains");
assert.deepEqual(JSON.parse(JSON.stringify(switched.targetMarkets)),["Sweden"],"target market selection may be reused");

const reactivated=activation.buildActivatedState(
  {...previous,website:"https://ccgroup.lv/",companyContextWebsite:"https://ccgroup.lv/"},
  {url:"https://www.ccgroup.lv/",title:"CCGROUP",text:"Fresh CCGROUP evidence"},
  "2026-09-11T00:00:00.000Z"
);
assert.deepEqual(JSON.parse(JSON.stringify(reactivated.answers)),previous.answers,"same-domain reactivation preserves customer input");
assert.deepEqual(JSON.parse(JSON.stringify(reactivated.documents)),previous.documents,"same-domain reactivation preserves uploaded material");

console.log("website activation company-context isolation: PASS");

(async()=>{
  const originalFetch=global.fetch;
  const originalAbortController=global.AbortController;
  let signalSeen=false;
  global.AbortController=class{constructor(){this.signal={};}abort(){}};
  global.fetch=async(_url,options)=>{
    signalSeen=Boolean(options?.signal);
    const error=new Error("simulated abort");error.name="AbortError";throw error;
  };
  await assert.rejects(()=>activation.scrapeWebsite("https://example.com"),/Website activation timed out after 25 seconds/);
  assert.equal(signalSeen,true,"website activation must pass an abort signal to the scraper");
  global.fetch=originalFetch;
  global.AbortController=originalAbortController;
  console.log("website activation timeout recovery: PASS");
})();
