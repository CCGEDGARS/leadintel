const test=require('node:test'),assert=require('node:assert/strict'),M=require('../company-lists.js');
const ref={id:'ref',name:'Reference factory',website:'https://reference.example/',ready:true,evidence:[{url:'https://reference.example/',quote:'Builds automated production equipment for factories'}]};
const available={references:[ref],signals:[{id:'lookalike',name:'Lookalike'},{id:'hiring',name:'Hiring'}],profile:{website:'https://seller.example/'}};
const config=(extra={})=>M.configuration({count:10,signalIds:['lookalike'],referenceIds:['ref'],markets:['Sweden'],budget:100,...extra},available);
const page={url:'https://factory.example/',text:'Factory makes automated production equipment. Factory operates from Stockholm in Sweden. Published 2026-11-01: Factory is hiring engineers for production equipment.',readAt:'2026-11-18T10:00:00Z'};
const raw={company:'Factory',website:page.url,identity:{url:page.url,quote:'Factory makes automated production equipment.'},location:{market:'Sweden',label:'Stockholm',url:page.url,quote:'Factory operates from Stockholm in Sweden.'},matches:[{signalId:'lookalike',url:page.url,quote:'Factory makes automated production equipment.',strength:95,referenceId:'ref',referenceQuote:ref.evidence[0].quote,reason:'Both build production equipment.'},{signalId:'hiring',url:page.url,quote:'Factory is hiring engineers for production equipment.',date:'2026-11-01',strength:85,reason:'Dated engineering vacancies'}]};
test('separate verified pages accumulate selected signals without losing stronger evidence',()=>{const c=config({signalIds:['lookalike','hiring'],mode:'all'}),now=Date.parse('2026-11-18'),a=M.assess({...raw,matches:[raw.matches[0]]},{...c,mode:'any'},[page],now),b=M.assess({...raw,matches:[raw.matches[1]]},{...c,mode:'any'},[page],now);const combined=M.mergeResult(a,b,c);assert.equal(combined.matches.length,2);assert.equal(combined.score,88);assert.equal(M.mergeResult(combined,a,c).score,88);assert.equal(M.mergeResult(a,{...b,domain:'another.example'},c).matches.length,1);});
test('one focused reference and custom sizes through 200; criteria resolve only saved signals and references',()=>{for(const count of [1,10,50,100,200])assert.equal(config({count}).count,count);for(const count of [0,201,1.5])assert.throws(()=>config({count}));assert.throws(()=>config({signalIds:['made-up']}));assert.throws(()=>config({referenceIds:[]}));assert.equal(config({signalIds:['hiring'],referenceIds:[]}).references.length,0);});
test('only selected signals score; any uses a fixed denominator while all requires every signal',()=>{const now=Date.parse('2026-11-18');const single=M.assess(raw,config(),[page],now);assert.equal(single.matches.length,1);assert.equal(single.score,90);const both=config({signalIds:['lookalike','hiring']}),r=M.assess(raw,both,[page],now);assert.equal(r.matches.length,2);assert.equal(r.score,88);const missing={...raw,matches:raw.matches.slice(0,1)};assert.equal(M.assess(missing,both,[page],now).score,45);assert.equal(M.assess(missing,{...both,mode:'all'},[page],now),null);});
test('invented quotes, unrelated reference quotes, unsupported location, wrong identity, old signals and unselected markets are rejected',()=>{const now=Date.parse('2026-11-18');for(const change of [{identity:{url:page.url,quote:'Invented company identity.'}},{location:{...raw.location,label:'Copenhagen'}},{website:'https://other.example/'},{location:{...raw.location,market:'Denmark'}},{matches:[{...raw.matches[0],referenceQuote:'An invented capability with no source.'}]}])assert.equal(M.assess({...raw,...change},config(),[page],now),null);assert.equal(M.assess(raw,config({signalIds:['hiring'],referenceIds:[]}),[page],Date.parse('2028-11-18')),null);});
test('reference country never becomes target market; grouping and independent industries preserve exact reference identity',()=>{const main={targetMarkets:['Denmark'],referenceCustomerPortfolio:{lists:[{id:'a',name:'Machinery',active:true,reference:{rows:[{id:'1',companyName:'Factory',website:'https://reference.example/',country:'Sweden',reason:'Buys equipment'}],analyses:{1:{sourceEvidence:ref.evidence}}}},{id:'b',name:'Healthcare',active:true,reference:{rows:[{id:'2',companyName:'Clinic',website:'https://clinic.example/'}],analyses:{2:{sourceEvidence:[{field:'industry',quote:'Provides clinical diagnostic services',url:'https://clinic.example/'}]}}}}]}};const o=M.options(main);assert.deepEqual(o.markets,['Denmark']);const c=M.configuration({count:10,signalIds:['lookalike'],referenceIds:['b:2'],markets:['Denmark']},o);assert.equal(c.references.length,1);assert.equal(c.references[0].name,'Clinic');assert.equal(c.references[0].evidence[0].quote,'Provides clinical diagnostic services');assert.deepEqual(main.targetMarkets,['Denmark']);});
test('exports preserve evidence, criteria and Unicode without executable spreadsheet formula cells',()=>{const r=M.assess(raw,config(),[page],Date.parse('2026-11-18')),list={name:'=DANGEROUS()',criteria:config(),results:[{...r,company:'=HYPERLINK("bad") Ā'}]};const csv=M.csv(list);assert.match(csv,/'=HYPERLINK/);assert.match(csv,/Unconfirmed/);assert.match(csv,/factory.example/);const xlsx=M.xlsx(list);assert.equal(new DataView(xlsx.buffer).getUint32(0,true),0x04034b50);const text=new TextDecoder().decode(xlsx);assert.match(text,/t="inlineStr"/);assert.doesNotMatch(text,/<f>/);assert.match(text,/Ā/);assert.match(text,/xl\/worksheets\/sheet1.xml/);});

test('active Lookalike alone excludes disabled/deleted signals and keeps string keywords for active signals',()=>{
 const main={market:{signals:[{id:'custom-lookalike-1',name:'Lookalike',active:true},{id:'hiring',name:'Hiring',active:false},{id:'funding',name:'Funding',active:true}],deletedSignalIds:['funding']}};
 const options=M.options(main);assert.deepEqual(options.signals.map(s=>s.id),['lookalike']);
 assert.throws(()=>M.configuration({count:200,signalIds:['hiring'],markets:['Denmark']},options),/no longer active/);
 main.market.signals[0].active=false;assert.deepEqual(M.options(main).signals,[]);
 main.market.signals=[{id:'expansion',name:'Expansion',keywords:'new factory; production capacity',active:true}];
 assert.deepEqual(M.options(main).signals.map(s=>s.id),['expansion']);assert.deepEqual(M.options(main).signals[0].keywords,['new factory','production capacity']);
 main.market.signals=[];assert.deepEqual(M.options(main).signals,[]);main.market.icps=[{id:'icp-reference-lookalike',active:true}];main.market.deletedSignalIds=['custom-lookalike-1'];assert.deepEqual(M.options(main).signals,[]);
});
test('every size uses the same evidence review; limits scale explicitly without relaxing the checks',()=>{
 const commercialFit={status:'supported',url:page.url,quote:raw.identity.quote,reason:'The documented manufacturing operation is relevant to industrial equipment.'};
 const review={decision:'pass',identityConfirmed:true,marketConfirmed:true,commercialFitConfirmed:true,exclusionsChecked:true,supportedSignalIds:['lookalike'],reason:'Source evidence establishes the business comparison and all required checks.',gaps:[]};
 for(const count of [1,10,50,100,200]){
  const c=config({count,budget:undefined});assert.equal(c.budget,M.recommendedBudget(count));
  const candidate=M.assess({...raw,commercialFit},c,[page]),result=M.reviewResult(candidate,review,c);
  assert.equal(result.quality.version,M.QUALITY_VERSION);assert.equal(result.matches[0].referenceUrl,ref.evidence[0].url);
  for(const changed of [{decision:'needs_evidence'},{identityConfirmed:false},{marketConfirmed:false},{commercialFitConfirmed:false},{exclusionsChecked:false},{supportedSignalIds:[]},{gaps:['Exclusion is unresolved']}])assert.equal(M.reviewResult(candidate,{...review,...changed},c),null);
  assert.equal(M.reviewResult(M.assess(raw,c,[page]),review,c),null,'no commercial evidence means no counted match');
 }
 assert.throws(()=>config({budget:5001}));assert.throws(()=>config({budget:0}));assert.equal(config({count:200,budget:150}).budget,150,'small explicit allowance is not silently raised');
});

test('new-policy identity must name the company; a domain footer or another company name prefix cannot substitute',()=>{
 const source={...page,text:page.text+' Factory10 manufactures equipment at factory.example.'};
 const identity={url:source.url,quote:'Factory10 manufactures equipment at factory.example.'};
 for(const company of ['Invented Factory','Factory1'])assert.equal(M.assess({...raw,company,identity},config(),[source]),null);
 assert.ok(M.assess({...raw,company:'Factory10',identity},config(),[source]));
});

test('saved snapshot exports rank every recorded score, preserve ties, and place missing scores after zero',()=>{
 const rows=[
  {company:'Awaiting Co',score:null},
  {company:'First equal',score:54,scoreState:'current',reviewStatus:'Checked'},
  {company:'Zero Co',score:0,scoreState:'current',reviewStatus:'Checked'},
  {company:'Provisional Co',score:73,scoreState:'current'},
  {company:'Previous Co',score:95,scoreState:'previous'},
  {company:'Second equal',score:54,scoreState:'previous'}
 ];
 const snapshot=M.normalizeSearchSnapshot({rows}),before=JSON.stringify(snapshot);
 const list={name:'Saved search',criteria:{kind:'search_snapshot',context:snapshot.context},results:snapshot.rows};
 const ordered=M.exportRows(list).slice(1);
 const expected=['Previous Co','Provisional Co','First equal','Second equal','Zero Co','Awaiting Co'];
 assert.deepEqual(ordered.map(r=>r[0]),expected);
 assert.deepEqual(ordered.map(r=>r[3]),[95,73,54,54,0,'']);
 assert.deepEqual(ordered.map(r=>r[4]),['Previous · needs review','Provisional · needs review','Current','Previous · needs review','Current','Awaiting score']);
 for(const content of [M.csv(list),new TextDecoder().decode(M.xlsx(list))]){
  let last=-1;
  for(const name of expected){const index=content.indexOf(name);assert.ok(index>last,name+' should follow the previous company');last=index;}
 }
 assert.equal(JSON.stringify(snapshot),before);
});
