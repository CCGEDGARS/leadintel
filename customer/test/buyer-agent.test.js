const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js'),CRM=require('../crm-engine.js');
const now=()=>new Date().toISOString();
function candidate(){return {company:'Stegra',domain:'stegra.com',buyerSearchMode:'user_selected_target',buyerRoles:['Procurement Director'],evidence:[{url:'https://stegra.com/project',text:'Our first plant is under construction in Boden in northern Sweden.',sourceRead:true,extractedAt:now()}],people:[{id:'klas',name:'Klas Nilsson',title:'Procurement Director',organization:'Stegra',linkedin_url:'https://linkedin.com/in/klas-nilsson-stegra'}]};}
function source(text,url='https://stegra.com/team'){return {url,markdown:text,sourceRead:true};}
test('context retains source-backed Boden trigger and workspace seller without treating location as employer',()=>{
 const c=candidate(),ctx=D.buyerAgentContext(c,{companyName:'Seller A',priorityOffers:'Steel fabrication'});
 assert.equal(ctx.company,'Stegra');assert.match(ctx.trigger.quote,/Boden/);assert.equal(ctx.trigger.url,'https://stegra.com/project');assert.match(ctx.seller,/Steel fabrication/);
 const other=D.buyerAgentContext({...c,company:'Clinic Network',domain:'clinic.example',evidence:[]},{companyName:'Seller B',priorityOffers:'Medical software'});
 assert.equal(other.trigger,null);assert.doesNotMatch(JSON.stringify(other),/Steel fabrication|Boden|Stegra/);
});
test('same-name people at different employers and exact profiles remain separate',()=>{
 const a={id:'a',name:'Klas Nilsson',title:'Procurement Director',organization:'Stegra',publicEmail:'klas@stegra.com'};
 const b={id:'b',name:'Klas Nilsson',title:'Communications Director',organization:'Boliden',publicPhone:'+46 70 123 4567'};
 const pool=D.mergeBuyerPool([a],[b],{decisionMakers:'Procurement Director; Communications Director'});
 assert.equal(pool.length,2);assert.equal(pool.find(p=>p.organization==='Stegra').publicPhone,undefined);
 const linked=D.mergeBuyerPool([{...a,linkedin_url:'https://linkedin.com/in/klas-stegra'}],[{...b,linkedin_url:'https://linkedin.com/in/klas-boliden'}],{decisionMakers:'Procurement Director; Communications Director'});assert.equal(linked.length,2);
});
test('snippets, job descriptions, stale biographies and other exact profiles cannot verify current employment',()=>{
 const c=candidate();c.people[0].contactResearch={checks:{buyer_agent:{status:'complete'}}};
 const text='Klas Nilsson, Procurement Director at Stegra.';
 for(const row of [{...source(text),sourceRead:false},source('Job description: '+text),{...source(text),date:'2016-08-09'},source(text,'https://linkedin.com/in/another-klas')])assert.equal(D.assessBuyerAgent(c,[row]).people[0].identity,'needs_review');
 const assessed=D.assessBuyerAgent(c,[source(text)]);assert.equal(assessed.people[0].identity,'supported');assert.equal(assessed.people[0].opportunity,'hypothesis');assert.equal(assessed.status,'needs_review');
});
test('current-role conflicts block qualification; unrelated namesakes do not change the saved person',()=>{
 const c=candidate(),ctx=D.buyerAgentContext(c);
 c.publicResearch={buyerAgent:D.assessBuyerAgent(c,[source('Klas Nilsson, Procurement Director. Current employer: Other Business; formerly Stegra.')],ctx)};
 assert.equal(c.publicResearch.buyerAgent.people[0].identity,'conflict');assert.ok(D.qualifyBuyer(c.people[0],{decisionMakers:'Procurement Director'},c).gaps.some(g=>g.includes('Buyer Agent')));
});
test('targeted checks execute, reuse successful query receipts, and never invoke paid contact providers',async()=>{
 const c=candidate(),queries=[],ctx=D.buyerAgentContext(c),rows=[source('Klas Nilsson, Procurement Director at Stegra, leads construction procurement for the plant in Boden.')];
 const options={buyerAgentContext:ctx,rows,search:async q=>{queries.push(q);return [];}};
 await D.runMandatoryBuyerResearch(c,options);
 assert.equal(c.people[0].contactResearch.checks.buyer_agent.queryLog.length,2);assert.ok(c.people[0].contactResearch.checks.buyer_agent.queryLog.every(q=>q.status==='complete'));
 assert.equal(c.publicResearch.buyerAgent.people[0].opportunity,'supported');assert.equal(c.publicResearch.buyerAgent.inputSignature,D.buyerReviewSignature(c));
 const count=queries.length;await D.runMandatoryBuyerResearch(c,options);assert.equal(queries.length,count);
 assert.ok(c.publicResearch.accountability.tools.filter(t=>['apollo','hunter'].includes(t.provider)).every(t=>t.attempted===0));
 const sig=D.buyerReviewSignature(c);c.people[0].linkedin_url='https://linkedin.com/in/another-person';assert.notEqual(D.buyerReviewSignature(c),sig);
});
test('failed targeted searches remain incomplete and source evidence survives workspace and CRM snapshots',async()=>{
 const c=candidate(),rows=[source('Klas Nilsson, Procurement Director at Stegra.')];
 await D.runMandatoryBuyerResearch(c,{buyerAgentContext:D.buyerAgentContext(c),rows,search:async q=>{if(q.includes('conference'))throw Error('Search unavailable');return [];}});
 assert.equal(c.publicResearch.buyerAgent.people[0].checks,'incomplete');assert.equal(c.publicResearch.buyerAgent.status,'needs_review');
 const restored=D.normalizeDiscoveryState({selectedProspects:[c]}).selectedProspects[0];assert.equal(restored.publicResearch.buyerAgent.people[0].evidence[0].url,'https://stegra.com/team');
 const mapped=CRM.mapDiscoveryCandidateToCrm(restored);assert.equal(mapped.intelligence.research_snapshot.buyerResearch.publicResearch.buyerAgent.version,D.BUYER_AGENT_VERSION);
 assert.equal(D.safeBuyerAgent(c.publicResearch.buyerAgent,'other.example'),null);
});

test('Buyer Agent panel exposes the explicit recheck, evidence and separate opportunity status',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom'),code=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8'),c=candidate();
 c.people[0].contactResearch={checks:{buyer_agent:{status:'complete'}}};c.publicResearch={buyerAgent:D.assessBuyerAgent(c,[source('Klas Nilsson, Procurement Director at Stegra.')])};
 const context={LeadIntelDiscovery:D,crmAuthenticated:()=>true,esc:v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')};vm.createContext(context);vm.runInContext(code.slice(code.indexOf('function buyerAgentHtml('),code.indexOf('function buyerQualitySupervisorHtml(')),context);
 const dom=new JSDOM(context.buyerAgentHtml(c)),doc=dom.window.document;
 assert.equal(doc.querySelector('[data-find-public-contacts]').textContent,'Recheck with Buyer Agent');assert.match(doc.body.textContent,/Identity \/ employer: supported/);assert.match(doc.body.textContent,/Opportunity: hypothesis/);assert.match(doc.body.textContent,/Boden/);assert.equal(doc.querySelector('a').href,'https://stegra.com/project');dom.window.close();
});

test('official company inventory cannot merge two different exact profiles sharing a name',()=>{
 const a={id:'a',name:'Alex Smith',title:'Procurement Director',organization:'Example',publicNameUrl:'https://example.com/team/a',companyContactSource:'official_staff',publicLinkedinUrl:'https://linkedin.com/in/alex-a',publicEmail:'alex.a@example.com'},b={...a,id:'b',publicNameUrl:'https://example.com/team/b',publicLinkedinUrl:'https://linkedin.com/in/alex-b',publicEmail:'alex.b@example.com'};
 const merged=D.mergeCompanyContacts([a],[b],{company:'Example',domain:'example.com'});assert.equal(merged.length,2);assert.equal(merged.find(p=>p.id==='a').publicEmail,'alex.a@example.com');
});
