import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';
import '../../customer/discovery-engine.js';

const examples=[
 {company:'Fjord Fabrication A/S',domain:'fabrication.example',market:'Denmark',blockedHome:true,about:'/om-os/',contact:'/kontakt/',leader:'Ida Larsen',operations:'Jens Thomsen',role:'produktionsdirektør',phone:'+45 12 34 56 78',intro:'I dag ejes Fjord Fabrication A/S af Holding ApS samt produktionsdirektør Jens Thomsen og CEO Ida Larsen.'},
 {company:'Harbor Clinics',domain:'harbor.example',market:'United Kingdom',about:'/en/about-us/',contact:'/en/contact/',leader:'Anna Walsh',operations:'Jane Ford',role:'Operations Director',phone:'+44 20 7000 1122',intro:'Harbor Clinics is led by CEO Anna Walsh and Operations Director Jane Ford.'}
];

for(const data of examples)test('free HTTP start, scheduled research and authenticated reopen for '+data.company,async t=>{
 const f=await buyerJobsFixture(t), D=globalThis.LeadIntelDiscovery,base='https://'+data.domain,fixtureDirectory=!data.blockedHome;
 const candidate={company:data.company,website:base+'/',domain:data.domain,market:data.market,people:[],buyerRoles:['CEO','Operations Director'],buyerSearchMode:'user_selected_target'};
 const requests=[],published='mail@'+data.domain,directory='https://association.example/member';
 t.mock.method(globalThis,'fetch',async input=>{
  const url=new URL(typeof input==='string'?input:input.url||input.href);
  requests.push(url.href);
  const html=text=>new Response(text,{headers:{'Content-Type':'text/html'}});
  if(url.hostname===data.domain){
   if(url.pathname==='/'&&!fixtureDirectory)return new Response('Homepage unavailable',{status:503});
   if(url.pathname==='/')return html('<h1>'+data.company+'</h1><a href="'+data.about+'">About us</a><a href="'+data.contact+'">Contact</a>');
   if(url.pathname===data.about)return html('<h1>About us</h1><p>'+data.intro+'</p><p>Client Ltd is led by CEO Alex Client.</p>');
   if(url.pathname===data.contact)return html('<h1>Contact us</h1><h3>'+data.phone+'</h3><p>'+published+'</p>');
  }
  if(url.hostname==='html.duckduckgo.com'){
   if(!fixtureDirectory)return new Response('Index unavailable',{status:503});
   if(url.searchParams.get('q').includes('aw@harbor.example'))return html('<h2><a href="'+directory+'">Member contact</a></h2><p>Office email addresses including aw@harbor.example</p>');
   return html('No results found');
  }
  if(fixtureDirectory&&url.href===directory)return html('<h1>Harbor Clinics</h1><p>Anna Walsh | Email: aw@harbor.example</p>');
  return new Response('Unavailable',{status:404});
 });
 const endpoint=f.env.APP_ORIGIN+'/api/buyers/research?workspace_id='+workspaceId;
 const headers={Cookie:'leadintel_session='+f.users.owner.token,Origin:f.env.APP_ORIGIN,'Content-Type':'application/json'};
 const waits=[],ctx={waitUntil:promise=>waits.push(promise)};
 const start=await app.fetch(new Request(endpoint,{method:'POST',headers,body:JSON.stringify({action:'start',candidate,freeDiscovery:true,peopleFirst:true})}),f.env,ctx);
 assert.equal(start.status,200,await start.clone().text());
 const id=(await start.json()).job.id;
 await Promise.all(waits.splice(0));
 let job;
 for(let i=0;i<8;i++){
  const response=await app.fetch(new Request(endpoint+'&job_id='+id,{headers}),f.env,{});
  assert.equal(response.status,200);job=(await response.json()).job;
  if(!['queued','running'].includes(job.status))break;
  await app.scheduled({cron:'* * * * *',scheduledTime:Date.now()},f.env,ctx);await Promise.all(waits.splice(0));
 }
 assert.equal(job.diagnostics.at(-1).code,'free_discovery_finished',JSON.stringify(job.diagnostics));
 const saved=job.candidate,people=saved.people;
 assert.deepEqual(people.map(p=>p.name).sort(),[data.operations,data.leader].sort());
 assert.ok(people.every(p=>p.publicNameUrl===base+data.about));
 assert.equal(people.find(p=>p.name===data.operations).title,data.role);
 assert.ok(people.every(p=>!D.confirmedBuyerPhone(saved,p)));
 assert.ok(saved.buyerDiscovery.officialContactInventory.channels.some(c=>c.value===published));
 assert.ok(saved.buyerDiscovery.officialContactInventory.routes.some(r=>r.value===data.phone));
 const leader=people.find(p=>p.name===data.leader);
 assert.equal(leader.publicEmail||'',fixtureDirectory?'aw@harbor.example':'');
 if(fixtureDirectory)assert.equal(leader.publicEmailUrl,directory);
 assert.ok(!people.find(p=>p.name===data.operations).publicEmail);
 assert.match(job.diagnostics.at(-1).reason,fixtureDirectory?/6 completed queries/:/index unavailable/);
 assert.ok(requests.every(url=>!/(?:api\.firecrawl|api\.perplexity|api\.openai|api\.apollo|hunter\.io)/.test(url)));
 assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM crm_enrichment_requests').get().n,0);
});
