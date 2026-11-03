const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js');
const company={company:'Acme Labs',domain:'acme.example'},name='Alex Morgan',title='Procurement Director',email='alex.morgan@acme.example',E1='https://acme.example/team/confirmed',E2='https://acme.example/contact/new';
const stamp=()=>new Date().toISOString(),body=(personName=name,address=email)=>`### ${personName}\n${title}\n${address}\nAcme Labs`;
function acceptedPerson(){
 const checkedAt=new Date(Date.now()-60000).toISOString();
 const person={id:'alex',name,publicName:name,title,organization:company.company,identityStatus:'confirmed',nameVerification:'confirmed',publicNameUrl:E1,publicEmail:email,publicEmailUrl:E1,publicEmailEvidence:{version:2,url:E1,quote:body(),sourceKind:'official',sourceRead:true,checkedAt},publicEmailSourceCheck:{version:2,status:'confirmed',email,url:E1,checkedAt}};
 assert.equal(D.acceptedOfficialBuyerEmail(company,person),email);return person;
}
function source(url=E2,extra={}){return {url,title:'Acme Labs staff',markdown:body(),extractedAt:stamp(),...extra};}
function binding(person,url){assert.equal(person.publicEmail,email);assert.equal(person.publicEmailUrl,url);assert.equal(person.publicEmailEvidence.url,url);assert.equal(person.publicEmailEvidence.sourceRead,true);assert.equal(D.acceptedOfficialBuyerEmail(company,person),email);}

for(const provenance of [{},{sourceRead:false}])test(`matching an unread same-address source cannot replace accepted E1: ${JSON.stringify(provenance)}`,()=>{
 const before=acceptedPerson(),value=D.matchPublicBuyerDetails([before],[source(E2,provenance)],company.domain,company.company)[0];
 binding(value,E1);assert.deepEqual(value.publicEmailEvidence,before.publicEmailEvidence);assert.deepEqual(value.publicEmailSourceCheck,before.publicEmailSourceCheck);
});

test('pool merge keeps the accepted source binding when a same-address incoming identity has only unread E2 evidence',()=>{
 const before=acceptedPerson(),incoming={...before,publicEmailUrl:E2,publicEmailEvidence:{version:2,url:E2,quote:body(),sourceKind:'official',checkedAt:stamp()},publicEmailSourceCheck:null};
 const value=D.mergeBuyerPool([before],[incoming],{decisionMakers:title})[0];
 binding(value,E1);assert.deepEqual(value.publicEmailSourceCheck,before.publicEmailSourceCheck);
});

test('a freshly read and attributable E2 may replace E1 without transferring the old check to a different URL',()=>{
 const before=acceptedPerson(),read=source(E2,{sourceRead:true}),value=D.matchPublicBuyerDetails([before],[read],company.domain,company.company)[0];
 binding(value,E2);assert.equal(value.publicEmailEvidence.checkedAt,read.extractedAt);
 if(value.publicEmailSourceCheck?.url===E2)assert.equal(value.publicEmailSourceCheck.checkedAt,read.extractedAt,'An E2 check needs its own read evidence timestamp');
 const incoming={...value,publicEmailSourceCheck:null},merged=D.mergeBuyerPool([before],[incoming],{decisionMakers:title})[0];binding(merged,E2);
});

for(const location of ['previous','incoming'])test(`an explicit failed E1 check on ${location} is never masked by source preservation`,()=>{
 const before=acceptedPerson(),failed={version:2,status:'failed',email,url:E1,checkedAt:stamp(),reason:'The original page no longer attributes this address'};
 const incoming={...before,publicEmailUrl:E2,publicEmailEvidence:{version:2,url:E2,quote:body(),sourceKind:'official',sourceRead:false,checkedAt:stamp()},publicEmailSourceCheck:location==='incoming'?failed:null};
 if(location==='previous')before.publicEmailSourceCheck=failed;
 const value=D.mergeBuyerPool([before],[incoming],{decisionMakers:title})[0];
 assert.equal(D.acceptedOfficialBuyerEmail(company,value),'');assert.notEqual(value.publicEmailEvidence?.sourceRead,true);
 assert.notEqual(value.publicEmailSourceCheck?.status,'confirmed','A rejected E1 cannot regain its previous successful check');
});

for(const change of [{name:'Jamie Carter',publicName:'Jamie Carter'},{publicEmail:'a.morgan@acme.example'}])test(`a changed identity or address cannot inherit the E1 binding: ${JSON.stringify(change)}`,()=>{
 const before=acceptedPerson(),incoming={...before,...change,publicEmailUrl:E2,publicEmailEvidence:{version:2,url:E2,quote:body(change.publicName||name,change.publicEmail||email),sourceKind:'official',sourceRead:false,checkedAt:stamp()},publicEmailSourceCheck:null};
 const value=D.mergeBuyerPool([before],[incoming],{decisionMakers:title}).find(person=>person.id===before.id);
 assert.equal(value.publicEmailUrl,E2);assert.notEqual(value.publicEmailEvidence?.sourceRead,true);assert.equal(D.acceptedOfficialBuyerEmail(company,value),'');
});

for(const provenance of [{sourceRead:false},{sourceRead:true,evidenceKind:'model_summary'}])test(`unread/model output cannot establish a new confirmed source: ${JSON.stringify(provenance)}`,()=>{
 const bare={...acceptedPerson(),publicEmail:'',publicEmailUrl:'',publicEmailEvidence:null,publicEmailSourceCheck:null};
 const value=D.matchPublicBuyerDetails([bare],[source(E2,provenance)],company.domain,company.company)[0];
 assert.equal(D.acceptedOfficialBuyerEmail(company,value),'');
});

test('the known accepted E1 body remains eligible after more than20 unrelated read pages and repairs an old unread E2 overwrite',()=>{
 const before=acceptedPerson(),bad={...before,publicEmailUrl:E2,publicEmailEvidence:{version:2,url:E2,quote:body(),sourceKind:'official',checkedAt:stamp()}},rows=Array.from({length:30},(_,i)=>({url:`https://acme.example/context/${i}`,sourceRead:true,extractedAt:stamp(),markdown:'Acme Labs official company background and project information.'}));
 rows.push(source(E1,{sourceRead:true,extractedAt:before.publicEmailEvidence.checkedAt}));
 const value=D.matchPublicBuyerDetails([bad],rows,company.domain,company.company)[0];binding(value,E1);
 assert.equal(value.publicEmailEvidence.checkedAt,before.publicEmailEvidence.checkedAt,'Cached source use cannot manufacture a new read timestamp');
});

for(const operation of ['match','merge'])test(`a stale original proof cannot confirm an unread new URL during ${operation}`,()=>{
 const before=acceptedPerson(),stale=new Date(Date.now()-31*86400000).toISOString();before.publicEmailEvidence.checkedAt=stale;before.publicEmailSourceCheck.checkedAt=stale;
 const row=source(E2,{sourceRead:false}),incoming={...before,publicEmailUrl:E2,publicEmailEvidence:{version:2,url:E2,quote:body(),sourceKind:'official',sourceRead:false,checkedAt:stamp()},publicEmailSourceCheck:null};
 const value=operation==='match'?D.matchPublicBuyerDetails([before],[row],company.domain,company.company)[0]:D.mergeBuyerPool([before],[incoming],{decisionMakers:title})[0];
 assert.equal(value.publicEmailUrl,E2);assert.notEqual(value.publicEmailEvidence?.sourceRead,true);assert.equal(D.acceptedOfficialBuyerEmail(company,value),'');
});
