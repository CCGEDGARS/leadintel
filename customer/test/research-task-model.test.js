const test=require('node:test'),assert=require('node:assert/strict'),T=require('../research-task-model.js');
test('task examples extract independent company and buyer scope, evidence and output without treating discussion as execution',()=>{
 assert.equal(T.requested('Use references from Flow 1 and find 50 most relevant companies in Denmark'),true);
 assert.deepEqual(T.extract('Use Flow 1 references and find 50 most relevant companies in Denmark, CSV',['Denmark','Sweden']),{flowQuery:'Flow 1',count:50,markets:['Denmark'],format:'csv',signalIds:['lookalike']});
 const p=T.extract('Find 1 best company in Denmark and two decision-makers with proven phone numbers, public only, PDF',['Denmark']);assert.equal(p.count,1);assert.equal(p.buyerCount,2);assert.equal(p.phoneEvidence,'confirmed');assert.equal(p.paidMode,'off');assert.equal(p.format,'pdf');
 assert.equal(T.requested('Is it possible to find 50 relevant companies?'),false);assert.equal(T.requested('Do not find companies yet'),false);assert.equal(T.requested('suggest buying signals for the reference companies that I added'),false);
});
test('absent references, cross-market scope, ambiguous buyer count and paid consent remain questions',()=>{
 const q=T.questions({flowId:'f',count:3,markets:['Denmark'],signalIds:['lookalike'],referenceIds:[],buyerCount:2,phoneEvidence:'confirmed',budget:100},{markets:['Sweden'],references:[]});
 for(const field of ['marketOverride','referenceIds','buyerScope','buyerCompanies','roles','paidMode','format'])assert.ok(q.some(item=>item.field===field),field);
});
test('funds and authentication are explicit blockers; unexplained provider failures remain uncertain',()=>{assert.equal(T.issue({status:402,message:'Insufficient credits'}).code,'funds');assert.equal(T.issue({status:401,message:'Invalid API key'}).code,'connection');assert.equal(T.issue({message:'Provider timeout'}).code,'research_gap');});
test('CSV formula protection and document escaping retain partial-outcome and phone evidence labels',()=>{
 const task={status:'blocked',plan:{count:3},blocker:{reason:'Phone source missing'},results:[{company:'=HYPERLINK("evil")',website:'https://supplier.example',location:'<script>alert(1)</script>',score:90,buyers:[{name:'John Smith',role:'Director',phone:'+4512345678',phoneStatus:'named_public_source',phoneSource:'https://supplier.example/team'}]}]};
 const csv=T.csv(task);assert.match(csv,/"'=HYPERLINK/);assert.match(csv,/"'\+4512345678"/);assert.match(csv,/named_public_source/);const doc=T.documentHtml(task);assert.match(doc,/1 of 3/);assert.match(doc,/Phone source missing/);assert.doesNotMatch(doc,/<script>/);assert.match(doc,/&lt;script&gt;/);
});


test('a single company can use explicit profile and buying-signal modes',()=>{
 assert.equal(T.requested('Use Flow 1 core profile and find 1 company in Sweden CSV'),true);
 assert.equal(T.extract('Use Flow 1 core profile, profiles only, find 1 company in Sweden CSV').signalMode,'off');
 assert.equal(T.extract('Find 10 companies matching all profiles; prioritize buying signals').profileMode,'all');
 assert.equal(T.extract('Find 10 companies matching all profiles; prioritize buying signals').signalMode,'boost');
 assert.equal(T.extract('Find 10 companies and require buying signals').signalMode,'require');
});
