const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const tick=()=>new Promise(r=>setTimeout(r,15));
test('website contact cards show real provider verification and require separate native channel confirmation',async()=>{
 const w=new JSDOM('<div id="website-scanning-workspace"></div>',{url:'https://app.fixture.test/customer/',runScripts:'outside-only'}).window,posts=[];w.LeadIntelWebsiteScanning=require('../website-scanning.js');w.LeadIntelDiscovery={acceptedOfficialBuyerEmail:()=>''};w.LeadIntelServerBridge={workspace:{id:'w'},session:{authenticated:true,user:{id:'owner'}}};let approved=false;w.LeadIntelDialogs={confirm:async()=>approved};
 const person={id:'web-anna',name:'Anna Andersson',title:'CEO',identityOrigin:'official',freeResearchStatus:'complete',gmailMatches:[{email:'anna.business@gmail.com',url:'https://finance.example/team',quote:'Anna Andersson at Finance Group · business contact anna.business@gmail.com'}],patternFindings:[{email:'anna.other@finance.example',url:'https://finance.example/contact'}],savedContact:{name:'Anna Andersson',work_email:'anna@finance.example',email_status:'Verified',verification_provider:'Apollo'}};
 const job={id:'j',companyId:'c',company:'Finance Group',domain:'finance.example',status:'complete',revision:7,phase:'contacts',label:'Public research complete',people:[person],channels:[],routes:[],sources:[],gaps:[],coverage:{},counts:{discovered:1,checked:1,pending:0,review:0,reads:3},description:'Finance Group provides financial services.',descriptionSourceUrl:'https://finance.example/'};
 w.fetch=async(_url,options)=>{if(options.method==='POST')posts.push(JSON.parse(options.body));return {ok:true,json:async()=>({job,paidPolicy:{provider:'treg',enabled:true,phoneEnabled:true},result:{cached:true}})};};w.eval(fs.readFileSync(require.resolve('../website-contact-ui.js'),'utf8'));
 await w.LeadIntelWebsiteContacts.open([{crmId:'c',name:'Finance Group',website:'https://finance.example/',description:'A source-backed company description.'}]);assert.match(w.document.body.textContent,/Verified by Apollo/);assert.doesNotMatch(w.document.body.textContent,/Possible published match/);assert.match(w.document.body.textContent,/anna.business@gmail.com/);assert.match(w.document.body.textContent,/Possible business Gmail match · unconfirmed/);assert.match(w.document.body.textContent,/anna.other@finance.example/);
 w.document.querySelector('[data-contact-action="paid-email"]').click();await tick();assert.equal(posts.length,0);approved=true;w.document.querySelector('[data-contact-action="paid-phone"]').click();await tick();assert.equal(posts.length,1);assert.deepEqual(posts[0],{action:'paid',jobId:'j',revision:7,personId:'web-anna',provider:'treg',channel:'phone',approved:true});w.LeadIntelWebsiteContacts.close();w.close();
});

test('paused research accounts for every person and explains identity and coverage holds',async()=>{
 const w=new JSDOM('<div id="website-scanning-workspace"></div>',{url:'https://app.fixture.test/customer/',runScripts:'outside-only'}).window;
 w.LeadIntelWebsiteScanning=require('../website-scanning.js');w.LeadIntelDiscovery={acceptedOfficialBuyerEmail:()=>''};w.LeadIntelServerBridge={workspace:{id:'w'},session:{authenticated:true,user:{id:'owner'}}};
 const job={id:'j',companyId:'c',company:'Finance Group',domain:'finance.example',status:'incomplete',revision:7,phase:'contacts',label:'Research paused after 30 minutes; completed contacts are saved',canResume:true,people:[{id:'held',name:'Anna Andersson',title:'CEO',identityOrigin:'official',identityConflict:true,freeResearchStatus:'needs_review',publicNameUrl:'https://finance.example/team'},{id:'other-role',name:'Anna Andersson',title:'Sales Manager',identityOrigin:'public_listing',identityConflict:true,freeResearchStatus:'needs_review',publicNameUrl:'https://listing.example/anna'},{id:'checked',name:'Bo Svensson',title:'Director',identityOrigin:'official',freeResearchStatus:'complete',publicEmail:'bo@finance.example',publicEmailUrl:'https://finance.example/team'},{id:'pending',name:'Cecilia Berg',title:'CFO',identityOrigin:'official'}],channels:[],routes:[],sources:[],gaps:['Public source extraction unavailable'],sourceIssues:[{kind:'read',value:'https://finance.example/blocked',reason:'Source timed out',attempts:2}],coverage:{},counts:{discovered:4,checked:1,review:2,pending:1,reads:53}};
 w.fetch=async()=>({ok:true,json:async()=>({job})});w.eval(fs.readFileSync(require.resolve('../website-contact-ui.js'),'utf8'));
 try{await w.LeadIntelWebsiteContacts.open([{crmId:'c',name:'Finance Group',website:'https://finance.example/'}]);
  const text=w.document.body.textContent;assert.match(text,/2.*need review/);assert.match(text,/Research checks finished/);assert.match(text,/does not confirm email or phone ownership/);
  assert.match(text,/Not checked yet/);assert.match(text,/Paid lookup locked:.*identity/i);assert.match(text,/Source timed out/);
  const card=w.document.querySelector('.website-contact-person');assert.ok(card.querySelector('a[href="https://listing.example/anna"]'),'the conflicting source must be inspectable');
  assert.ok(card.querySelector('[data-contact-action="paid-email"]').disabled);assert.ok(w.document.querySelector('[data-contact-action="resume"]'));
 }finally{w.LeadIntelWebsiteContacts.close();w.close();}
});

test('opening active research wakes saved work without restarting a paused run',async()=>{
 const w=new JSDOM('<div id="website-scanning-workspace"></div>',{url:'https://app.fixture.test/customer/',runScripts:'outside-only'}).window,posts=[];
 w.LeadIntelWebsiteScanning=require('../website-scanning.js');w.LeadIntelServerBridge={workspace:{id:'w'},session:{authenticated:true,user:{id:'owner'}}};
 const job={id:'j',companyId:'c',company:'Finance Group',domain:'finance.example',status:'queued',revision:9,phase:'contacts',people:[],channels:[],routes:[],sources:[],gaps:[],coverage:{},counts:{discovered:0,checked:0,pending:0,reads:1}};
 w.fetch=async(_url,options)=>{if(options.method==='POST')posts.push(JSON.parse(options.body));return {ok:true,json:async()=>({job})};};w.eval(fs.readFileSync(require.resolve('../website-contact-ui.js'),'utf8'));
 try{
  await w.LeadIntelWebsiteContacts.open([{crmId:'c',name:'Finance Group',website:'https://finance.example/'}]);assert.deepEqual(posts,[{action:'wake',jobId:'j'}]);
  w.LeadIntelWebsiteContacts.close();posts.length=0;job.status='incomplete';job.stopReason='time_limit';job.canResume=true;
  await w.LeadIntelWebsiteContacts.open([{crmId:'c',name:'Finance Group',website:'https://finance.example/'}]);assert.deepEqual(posts,[]);assert.match(w.document.body.textContent,/Time limit reached · results saved/);assert.match(w.document.body.textContent,/five-minute/);
 }finally{w.LeadIntelWebsiteContacts.close();w.close();}
});
