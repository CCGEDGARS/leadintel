const test=require('node:test'),assert=require('node:assert/strict'),T=require('../target-criteria.js');

// Neutral fixtures: no customer names, industries chosen only to exercise the rules.
const criteria=(extra={})=>T.normalize({employees:{min:25,max:250},revenue:{min:3000000,idealMin:10000000,idealMax:100000000,currency:'EUR'},industries:['24','25'],registryOnly:true,...extra});
const found=(extra={})=>({status:'found',registry:'DK-CVR',country:'DK',id:'11111111',name:'Example Steel A/S',active:true,industry:{code:'251100',label:'Manufacture of metal structures'},employees:{count:120},revenue:null,...extra});
const check=(result,key)=>result.checks.find(c=>c.key===key);

test('absent or empty input means no structured criteria',()=>{
 for(const raw of [undefined,null,{},{employees:{},revenue:{},industries:[]}])assert.equal(T.normalize(raw),null);
});

test('normalize keeps whole numbers, two-digit industry divisions and a default currency',()=>{
 const c=T.normalize({employees:{min:'25',max:250},revenue:{min:3000000},industries:['25',' 24 ','25'],registryOnly:false});
 assert.deepEqual(c,{version:1,employees:{min:25,max:250},revenue:{min:3000000,idealMin:null,idealMax:null,currency:'EUR'},industries:['24','25'],registryOnly:false});
 assert.equal(T.normalize({employees:{max:250}}).employees.min,null);
 assert.equal(T.normalize({industries:['07']}).registryOnly,true);
});

test('invalid ranges and codes are rejected with a 400 instead of being guessed',()=>{
 for(const raw of [
  {employees:{min:250,max:25}},{employees:{min:-1}},{employees:{min:1.5}},{employees:{max:'many'}},
  {revenue:{min:-5}},{revenue:{min:1,currency:'euros'}},{revenue:{idealMin:5,idealMax:1}},{revenue:{min:10,idealMin:5}},
  {industries:['metal']},{industries:['100']},{industries:Array.from({length:41},(_,i)=>String(i+10))},{industries:'25'},
 ])assert.throws(()=>T.normalize(raw),e=>e.status===400,JSON.stringify(raw));
});

test('a registered active company inside every known range passes with one reason per criterion',()=>{
 const r=T.evaluate(criteria(),found());
 assert.equal(r.decision,'pass');assert.deepEqual(r.excludedBy,[]);
 assert.deepEqual(r.checks.map(c=>[c.key,c.status]),[['registry','match'],['industry','match'],['employees','reported'],['revenue','unknown']]);
 assert.match(check(r,'registry').detail,/11111111/);assert.match(check(r,'employees').detail,/120/);
 assert.match(check(r,'revenue').detail,/unavailable/i);
});

test('published and missing counts both keep the company',()=>{
 for(const count of [3108,833,251,24,0]){const r=T.evaluate(criteria(),found({employees:{count}}));assert.equal(r.decision,'pass',String(count));assert.deepEqual(r.excludedBy,[]);}
 for(const count of [25,250])assert.equal(T.evaluate(criteria(),found({employees:{count}})).decision,'pass');
 for(const employees of [null,{},{count:null}]){const r=T.evaluate(criteria(),found({employees}));assert.equal(r.decision,'pass');assert.equal(check(r,'employees').status,'unknown');}
});

test('registry intervals are reported verbatim',()=>{
 const status=(min,max)=>{const r=T.evaluate(criteria(),found({employees:{min,max}}));return [r.decision,check(r,'employees').status];};
 assert.deepEqual(status(50,99),['pass','reported']);
 assert.deepEqual(status(20,49),['pass','reported']);
 assert.deepEqual(status(200,499),['pass','reported']);
 assert.deepEqual(status(500,999),['pass','reported']);
 assert.deepEqual(status(1000,null),['pass','reported']);
 assert.deepEqual(status(10,19),['pass','reported']);
});

test('industry outside the selected divisions excludes; holding and head-office codes stay unknown',()=>{
 const off=T.evaluate(criteria(),found({industry:{code:'204200',label:'Manufacture of perfumes'}}));
 assert.equal(off.decision,'exclude');assert.deepEqual(off.excludedBy,['industry']);assert.match(check(off,'industry').detail,/perfumes/);
 for(const code of ['642120','701010']){const r=T.evaluate(criteria(),found({industry:{code,label:'Holding'}}));assert.equal(r.decision,'pass',code);assert.equal(check(r,'industry').status,'unknown');}
 const none=T.evaluate(criteria(),found({industry:null}));assert.equal(check(none,'industry').status,'unknown');
 const noRule=T.evaluate(criteria({industries:[]}),found({industry:{code:'204200',label:'Perfumes'}}));
 assert.equal(noRule.decision,'pass');assert.equal(check(noRule,'industry'),undefined);
});

test('registry-only mode excludes companies the register does not hold; relaxed mode keeps them flagged',()=>{
 const strict=T.evaluate(criteria(),{status:'not_found',registry:'DK-CVR',country:'DK'});
 assert.equal(strict.decision,'exclude');assert.deepEqual(strict.excludedBy,['registry']);
 const relaxed=T.evaluate(criteria({registryOnly:false}),{status:'not_found',registry:'DK-CVR',country:'DK'});
 assert.equal(relaxed.decision,'pass');assert.equal(check(relaxed,'registry').status,'unknown');
 const closed=T.evaluate(criteria(),found({active:false,statusLabel:'Dissolved'}));
 assert.equal(closed.decision,'exclude');assert.match(check(closed,'registry').detail,/Dissolved/);
});

test('an outage, an ambiguous match or a market without a register never excludes and never confirms',()=>{
 for(const facts of [null,undefined,{status:'unavailable'},{status:'ambiguous',registry:'DK-CVR'},{status:'unsupported'}]){
  const r=T.evaluate(criteria(),facts);
  assert.equal(r.decision,'pass');assert.equal(check(r,'registry').status,'unknown');
  for(const c of r.checks)assert.equal(c.status,'unknown',c.key);
 }
});

test('published turnover retains its original currency and year regardless of legacy thresholds',()=>{
 for(const [amount,currency] of [[2900000,'EUR'],[1000000,'DKK'],[200000000,'EUR']]){
  const result=T.evaluate(criteria(),found({revenue:{amount,currency,year:2025}}));
  assert.deepEqual(result.excludedBy,[]);
  assert.deepEqual(check(result,'revenue'),{key:'revenue',status:'reported',detail:amount.toLocaleString('en-US')+' '+currency+' (2025)'});
 }
});

test('without criteria nothing is evaluated',()=>{
 assert.deepEqual(T.evaluate(null,found()),{decision:'pass',checks:[],excludedBy:[]});
});

test('describe states the saved rules in plain words',()=>{
 const text=T.describe(criteria());
 assert.match(text,/turnover.*evidence/i);assert.doesNotMatch(text,/25–250|3,000,000/);assert.match(text,/24, 25/);assert.match(text,/register/i);
 assert.equal(T.describe(null),'');
});

test('a group reports headcount with its entity scope',()=>{
 const group=found({name:'EXAMPLE MANUFACTURING A/S',id:'22222222',employees:{min:3325,max:null},group:{members:4,basis:'largest active entity whose legal name starts with the company name'}});
 const r=T.evaluate(criteria(),group);
 assert.equal(r.decision,'pass');assert.deepEqual(r.excludedBy,[]);
 assert.match(check(r,'registry').detail,/^Registered group \(4 entities\), largest: EXAMPLE MANUFACTURING A\/S \(DK-CVR 22222222\)/);
 assert.match(check(r,'employees').detail,/3,325\+ employees/);
 const small=T.evaluate(criteria(),{...group,employees:{min:40,max:null}});
 assert.equal(small.decision,'pass');assert.equal(check(small,'employees').status,'reported');
});

test('a quoted first-party statement of an allowed activity overrides a register code, and never excludes by itself',()=>{
 const wholesale={code:'467200',label:'Wholesale of motor vehicle parts'};
 const evidence={division:'25',url:'https://example.test/about',quote:'We manufacture welded steel structures'};
 const rescued=T.evaluate(criteria(),found({industry:wholesale}),{industryEvidence:evidence});
 assert.equal(rescued.decision,'pass');assert.equal(check(rescued,'industry').status,'match');
 assert.match(check(rescued,'industry').detail,/46\.72 Wholesale of motor vehicle parts/);assert.match(check(rescued,'industry').detail,/We manufacture welded steel structures/);
 assert.deepEqual(check(rescued,'industry').evidence,{url:evidence.url,quote:evidence.quote});
 // Evidence for an activity outside the selection changes nothing in either direction.
 const other={...evidence,division:'20'};
 assert.equal(T.evaluate(criteria(),found({industry:wholesale}),{industryEvidence:other}).decision,'exclude');
 assert.equal(check(T.evaluate(criteria(),found(),{industryEvidence:other}),'industry').status,'match');
 // Without a register opinion the quoted activity confirms the industry.
 for(const facts of [found({industry:null}),found({industry:{code:'642120',label:'Holding'}}),{status:'ambiguous',registry:'DK-CVR'},null]){
  assert.equal(check(T.evaluate(criteria(),facts,{industryEvidence:evidence}),'industry').status,'match');
  assert.equal(check(T.evaluate(criteria(),facts,{industryEvidence:other}),'industry').status,'unknown');
 }
 // Incomplete evidence is ignored.
 for(const bad of [{division:'25'},{division:'25',url:evidence.url},{division:'metal',url:evidence.url,quote:evidence.quote},{}])
  assert.equal(T.evaluate(criteria(),found({industry:wholesale}),{industryEvidence:bad}).decision,'exclude');
});

test('the industry divisions offered in forms are unique two-digit codes with a title',()=>{
 assert.ok(T.DIVISIONS.length>80);assert.equal(new Set(T.DIVISIONS.map(d=>d.code)).size,T.DIVISIONS.length);
 assert.ok(T.DIVISIONS.every(d=>/^\d{2}$/.test(d.code)&&d.label));
 assert.equal(T.DIVISIONS.find(d=>d.code==='25').label,'Fabricated metal products');
 assert.ok(T.DIVISIONS.length>T.MAX_INDUSTRIES);
});
