const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js');
const name='Alex Morgan',official='https://acme.example/team',source='https://industry.example/people/alex-morgan',phone='+46 70 111 2233';
const body=`### ${name}\nProcurement Director at Acme Labs\nalex.morgan@acme.example\n${phone}`;
function candidate(){return {company:'Acme Labs',domain:'acme.example',buyerSearchMode:'user_selected_target',people:[{id:'alex',name,publicName:name,title:'Procurement Director',organization:'Acme Labs',identityStatus:'confirmed',publicNameUrl:official}]};}
async function run(requested,read){const c=candidate(),calls=[],rows=[{url:official,markdown:`${name} — Procurement Director at Acme Labs`,sourceRead:true}];await D.runMandatoryBuyerResearch(c,{rows,search:async()=>[],crossCheck:async()=>({status:'complete',web_search:true,results:[{url:requested,title:name}]}),readPage:async url=>{calls.push(url);return read(url);}});return {c,calls,rows,check:c.people[0].contactResearch.checks.independent};}
test('a canonical trailing slash on an external source preserves actual URL attribution',async()=>{
 const {rows,check}=await run(source,async url=>({url:url===source?source+'/':url,metadata:{sourceURL:url===source?source+'/':url},markdown:body}));
 assert.equal(check.status,'complete');assert.equal(check.queryLog[0].sourceReads[0].url,source+'/');assert.equal(rows.find(r=>r.url===source+'/'&&r.sourceRead===true).markdown,body);
});
test('an external host move acquires the destination separately before accepting its evidence',async()=>{
 const requested='https://staging.example/people/alex-morgan';
 const {rows,calls,check}=await run(requested,async url=>({url:url===requested?source:url,metadata:{sourceURL:url===requested?source:url},markdown:body}));
 assert.ok(calls.includes(source),'A transport redirect is only a source-discovery hint');assert.equal(check.status,'complete');assert.equal(rows.find(r=>r.url===source&&r.sourceRead===true).markdown,body);assert.equal(check.queryLog[0].sourceReads[0].url,source);
});
test('a failed destination read never inherits a redirected body as proof',async()=>{
 const requested='https://staging.example/people/alex-morgan';const {c,calls,check}=await run(requested,async url=>{if(url===source)throw Error('Destination unavailable');return {url:url===requested?source:url,markdown:body};});
 assert.ok(calls.includes(source));assert.equal(check.status,'partial');assert.equal(D.confirmedBuyerContactData(c,c.people[0]).phone,'');
});
test('a company source redirected to a foreign host remains rejected',async()=>{
 const requested='https://acme.example/people/alex-morgan';const {c,calls,check}=await run(requested,async url=>({url:url===requested?source:url,markdown:body}));
 assert.ok(!calls.includes(source));assert.equal(check.status,'partial');assert.equal(D.confirmedBuyerContactData(c,c.people[0]).phone,'');
});
test('external move resolution is bounded to one separately read destination',async()=>{
 const requested='https://staging.example/people/alex-morgan',other='https://other.example/people/alex-morgan';
 const {c,calls,check}=await run(requested,async url=>({url:url===requested?source:url===source?other:url,markdown:body}));
 assert.ok(calls.includes(source));assert.ok(!calls.includes(other));assert.equal(check.status,'partial');assert.equal(D.confirmedBuyerContactData(c,c.people[0]).phone,'');
});
test('a moved destination cannot then jump to a different official page',async()=>{
 const requested='https://staging.example/people/alex-morgan';const {check}=await run(requested,async url=>({url:url===requested?source:url===source?'https://acme.example/unrelated':url,markdown:body}));
 assert.equal(check.status,'partial');
});
