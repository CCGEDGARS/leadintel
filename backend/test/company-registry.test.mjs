import test from 'node:test';
import assert from 'node:assert/strict';
import {registryMarket,lookupCompanyFacts} from '../src/company-registry.js';

// Response shapes recorded from the public CVR JSON API on 20 Nov 2026; names and numbers are invented.
const entity=(extra={})=>({vat:11111111,name:'NORDSTÅL A/S',city:'Give',protected:false,phone:null,email:null,website:null,startdate:'2008-05-20',enddate:null,employees:120,industrycode:251100,industrydesc:'Fremstilling af metalkonstruktioner og dele heraf',status:'NORMAL',bankrupt:false,companytypeshort:'A/S',...extra});
const holding=entity({vat:22222222,name:'Nordstål Group A/S',employees:null,industrycode:642120,industrydesc:'Ikke-finansielle holdingselskaber'});
const dissolved=entity({vat:33333333,name:'Nordstål ApS',employees:null,status:'OPLØSTEFTERFRIVILLIGLIKVIDATION',enddate:'2019-01-01'});
const json=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body});

function api(routes){
 const calls=[];
 const fetch=async(url,options={})=>{
  calls.push({url:String(url),headers:options.headers||{}});
  const path=decodeURIComponent(new URL(url).pathname);
  for(const [suffix,reply] of Object.entries(routes))if(path.endsWith(suffix))return typeof reply==='function'?reply():reply;
  return json({detail:'Not Found'},404);
 };
 return {fetch,calls};
}
const lookup=(input,routes,options={})=>{const a=api(routes);return lookupCompanyFacts({market:'Denmark',company:'Nordstål A/S',website:'https://www.nordstaal.example/',pages:[],...input},{fetch:a.fetch,now:Date.parse('2026-11-20T18:00:00Z'),...options}).then(facts=>({facts,calls:a.calls}));};

test('only markets with a connected register are supported',()=>{
 for(const market of ['Denmark','denmark','Danmark','DK'])assert.equal(registryMarket(market),'DK');
 for(const market of ['Sweden','Latvia','',undefined,'Denmark and Norway'])assert.equal(registryMarket(market),'');
});

test('an unsupported market makes no request',async()=>{
 const {facts,calls}=await lookup({market:'Sweden'},{});
 assert.deepEqual(facts,{status:'unsupported'});assert.equal(calls.length,0);
});

test('one active entity with the same name becomes register facts with its source',async()=>{
 const {facts,calls}=await lookup({},{'/search/company/Nordstål':json([dissolved,entity(),holding])});
 assert.deepEqual(facts,{status:'found',registry:'DK-CVR',country:'DK',id:'11111111',name:'NORDSTÅL A/S',city:'Give',active:true,statusLabel:'NORMAL',
  industry:{code:'251100',label:'Fremstilling af metalkonstruktioner og dele heraf'},employees:{count:120},revenue:null,marketingProtected:false,
  source:{name:'CVR (Danish Central Business Register) via apicvr.dk',url:'https://apicvr.dk/api/v1/11111111',checkedAt:'2026-11-20T18:00:00.000Z'}});
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,'https://apicvr.dk/api/v1/search/company/Nordst%C3%A5l');
 assert.match(calls[0].headers['User-Agent'],/^LeadIntel/);
});

test('a register number printed on the company’s own website wins over the name search',async()=>{
 const pages=[{url:'https://nordstaal.example/kontakt',text:'Nordstål · Industrivej 1 · CVR-nr. 44 44 44 44 · Tlf. 70 00 00 00'},{url:'https://directory.example/nordstaal',text:'CVR 55555555'}];
 const {facts,calls}=await lookup({pages},{'/v1/44444444':json(entity({vat:44444444,name:'NS Production A/S',employees:61,protected:true}))});
 assert.equal(facts.status,'found');assert.equal(facts.id,'44444444');assert.deepEqual(facts.employees,{count:61});assert.equal(facts.marketingProtected,true);
 assert.deepEqual(calls.map(c=>new URL(c.url).pathname),['/api/v1/44444444']);
});

test('an unknown printed number falls back to the name search',async()=>{
 const pages=[{url:'https://nordstaal.example/',text:'CVR: 99999999'}];
 const {facts,calls}=await lookup({pages},{'/search/company/Nordstål':json([entity()])});
 assert.equal(facts.id,'11111111');assert.equal(calls.length,2);
});

test('a registered website or e-mail domain selects the entity when names differ',async()=>{
 const byWebsite=await lookup({company:'Nordstål'},{'/search/company/Nordstål':json([holding,entity({vat:66666666,name:'NS Danmark A/S',website:'www.nordstaal.example'})])});
 assert.equal(byWebsite.facts.id,'66666666');
 const byEmail=await lookup({company:'Nordstål'},{'/search/company/Nordstål':json([entity({vat:77777777,name:'NS Danmark A/S',email:'info@nordstaal.example'})])});
 assert.equal(byEmail.facts.id,'77777777');
});

test('several active entities with the same name are ambiguous unless exactly one reports employees',async()=>{
 const twin=entity({vat:88888888,city:'Vejle',employees:40});
 assert.deepEqual((await lookup({},{'/search/company/Nordstål':json([entity(),twin])})).facts,{status:'ambiguous',registry:'DK-CVR',country:'DK'});
 assert.equal((await lookup({},{'/search/company/Nordstål':json([entity(),{...twin,employees:null}])})).facts.id,'11111111');
});

test('not found means the register holds no active entity carrying the name; related or closed names stay ambiguous',async()=>{
 assert.deepEqual((await lookup({},{'/search/company/Nordstål':json([])})).facts,{status:'not_found',registry:'DK-CVR',country:'DK'});
 assert.equal((await lookup({},{'/search/company/Nordstål':json([entity({name:'Sydstål A/S'}),entity({name:'Nordstålværket ApS'})])})).facts.status,'not_found');
 assert.equal((await lookup({},{'/search/company/Nordstål':json([holding])})).facts.status,'ambiguous');
 assert.equal((await lookup({},{'/search/company/Nordstål':json([entity({name:'A. Jensen Nordstål A/S'})])})).facts.status,'ambiguous');
 assert.equal((await lookup({},{'/search/company/Nordstål':json([dissolved])})).facts.status,'ambiguous');
});

// Both cases were observed against the live register on 20 Nov 2026.
test('the exact legal name beats a sibling that only shares the e-mail domain',async()=>{
 const sibling=entity({vat:12121212,name:'Nordstål Offshore Wind Denmark ApS',employees:null,email:'post@nordstaal.example',industrycode:642110});
 assert.equal((await lookup({},{'/search/company/Nordstål':json([sibling,entity()])})).facts.id,'11111111');
});

const club=entity({vat:13131313,name:'Nordstål Klub 164',employees:null,email:'klub@nordstaal.example',industrycode:949900,status:'Aktiv'});

test('an association using the company e-mail domain is never selected for the company',async()=>{
 assert.deepEqual((await lookup({company:'Nordstål'},{'/search/company/Nordstål':json([club])})).facts,{status:'ambiguous',registry:'DK-CVR',country:'DK'});
 assert.deepEqual((await lookup({company:'Nordstål'},{'/search/company/Nordstål':json([club,entity({vat:16161616,name:'MHI Nordstål Service A/S',employees:900})])})).facts,{status:'ambiguous',registry:'DK-CVR',country:'DK'});
});

test('a group name without its own legal entity reports the largest member as a lower bound of its size',async()=>{
 const members=[
  entity({vat:14141414,name:'Nordstål Wind Systems A/S',employees:3108,industrycode:721000,industrydesc:'Forskning'}),
  entity({vat:15151515,name:'NORDSTÅL MANUFACTURING A/S',employees:3325,industrycode:281100,industrydesc:'Fremstilling af motorer og turbiner',city:'Aarhus N'}),
  entity({vat:17171717,name:'Nordstål Americas A/S',employees:null,industrycode:642120}),
  entity({vat:18181818,name:'Nordstål Towers A/S',employees:9000,status:'OPLØSTEFTERFUSION',enddate:'2015-01-01'}),
 ];
 const {facts}=await lookup({company:'Nordstål'},{'/search/company/Nordstål':json([club,...members])});
 assert.equal(facts.status,'found');assert.equal(facts.id,'15151515');assert.equal(facts.name,'NORDSTÅL MANUFACTURING A/S');
 assert.deepEqual(facts.employees,{min:3325,max:null});
 assert.deepEqual(facts.group,{members:2,basis:'largest active entity whose legal name starts with the company name'});
 assert.equal(facts.industry.code,'281100');
 // Members without an employee count cannot size the group.
 assert.equal((await lookup({company:'Nordstål'},{'/search/company/Nordstål':json([club,members[2]])})).facts.status,'ambiguous');
});

test('a printed number of a closed company reports its real status',async()=>{
 const pages=[{url:'https://nordstaal.example/',text:'CVR 33333333'}];
 const {facts}=await lookup({pages},{'/v1/33333333':json(dissolved)});
 assert.equal(facts.status,'found');assert.equal(facts.active,false);assert.equal(facts.statusLabel,'OPLØSTEFTERFRIVILLIGLIKVIDATION');
 const bankrupt=await lookup({pages},{'/v1/33333333':json(entity({vat:33333333,bankrupt:true,status:'UNDERKONKURS'}))});
 assert.equal(bankrupt.facts.active,false);
});

test('legal forms and punctuation never break the request path',async()=>{
 for(const [company,term] of [['Nordstål A/S','Nordstål'],['A/S Nordstål','Nordstål'],['Nordstål & Søn ApS','Nordstål & Søn'],['NORDSTÅL  I/S','NORDSTÅL']]){
  const {calls}=await lookup({company},{});
  assert.equal(new URL(calls[0].url).pathname,'/api/v1/search/company/'+encodeURIComponent(term),company);
 }
 assert.deepEqual((await lookup({company:'A/S'},{})).facts,{status:'not_found',registry:'DK-CVR',country:'DK'});
});

test('rate limits, server errors, invalid bodies and network failures are unavailable, never not-found',async()=>{
 for(const reply of [json({},429),json({},503),json({detail:'x'},200),()=>{throw new Error('socket closed');},{ok:true,status:200,json:async()=>{throw new SyntaxError('bad json');}}]){
  const {facts}=await lookup({},{'/search/company/Nordstål':reply});
  assert.deepEqual(facts,{status:'unavailable',registry:'DK-CVR',country:'DK'});
 }
});

test('a caller cancellation is not swallowed as an outage',async()=>{
 const controller=new AbortController();controller.abort(Object.assign(Error('slice finished'),{code:'slice_finished'}));
 await assert.rejects(()=>lookup({},{},{signal:controller.signal}),e=>e.code==='slice_finished');
});

test('at most four requests serve one company',async()=>{
 const pages=[{url:'https://nordstaal.example/',text:'CVR 10000001, CVR 10000002, CVR 10000003, CVR 10000004, CVR 10000005'}];
 const {calls}=await lookup({pages},{});
 assert.equal(calls.length,4);
});
