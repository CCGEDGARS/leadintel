const test=require('node:test');
const assert=require('node:assert/strict');
const Report=require('../research-report.js');
const Market=require('../market-engine.js');
test('opening the research workbench initializes reports without visiting Strategy',()=>{const fs=require('node:fs');const app=fs.readFileSync(require.resolve('../app.js'),'utf8');const callback=app.match(/addEventListener\("leadintel:profile-market-opened",\(\)=>\{([^}]+)\}/)?.[1];assert.ok(callback);const calls=[];require('node:vm').runInNewContext(callback,Object.fromEntries(['renderResearchReports','renderResearchControls','renderResearchStatus','renderMarketJourney'].map(name=>[name,()=>calls.push(name)])));assert.equal(calls[0],'renderResearchReports');});
const fixture={profile:{companyName:'Acme Legal',targetMarkets:'Finland',priorityOffers:'Legal support'},market:{researchMode:'quick',researchStatus:'partial',lastResearchAt:'2026-10-01',researchSourceStatus:{openai:'unavailable',firecrawl:'complete'},researchResults:[{url:'https://example.com/project',title:'New project',description:'Source excerpt',text:'long '.repeat(500),extractedAt:'2026-10-01',extractedBy:'firecrawl'}],researchErrors:[{provider:'OpenAI',message:'Unavailable'}],signals:[{name:'Legal proceedings',active:true}],researchQuality:{confidence:'Low',gaps:['source diversity']}}};
test('snapshot is independent, bounded and excludes credentials',()=>{const main=structuredClone(fixture);main.apiKey='secret';const r=Report.snapshot(main,'one');main.market.researchResults[0].title='Changed';assert.equal(r.sources[0].title,'New project');assert.ok(r.sources[0].text.length<=900);assert.ok(!JSON.stringify(r).includes('secret'));});
test('dated report history survives state reload and retains separate runs',()=>{const one=Report.snapshot(fixture,'one'),two=Report.snapshot(fixture,'two');const state=Market.normalizeMarketState({researchReports:Report.append([one],two)});assert.deepEqual(state.researchReports.map(x=>x.id),['two','one']);assert.equal(state.researchReports[1].sources[0].url,fixture.market.researchResults[0].url);assert.equal(Report.append([one],one).length,1);assert.equal(Report.normalize(Array.from({length:15},(_,i)=>({...one,id:String(i)}))).length,10);});
test('portable report includes citations, caveats and print styles without unsafe markup',()=>{const r=Report.snapshot(fixture);r.company='<script>alert(1)</script>';r.sources.push({url:'javascript:alert(1)',title:'<img onerror=alert(1)>'});const html=Report.documentHtml(r);assert.ok(html.includes('href="#source-1"'));assert.ok(html.includes('Partial or unverified coverage'));assert.ok(html.includes('OpenAI: Unavailable'));assert.ok(html.includes('@media print'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('href="javascript:'));assert.ok(html.includes('&lt;img'));assert.ok(html.includes('Review in Strategy'));});
test('quick and deeper templates only display collected conditions',()=>{const quick=Report.body(Report.snapshot(fixture));assert.ok(!quick.includes('<h3>funding</h3>'));const main=structuredClone(fixture);main.market.researchMode='deep';main.market.marketConditions={funding:{summary:'No active funding verified'}};assert.ok(Report.body(Report.snapshot(main)).includes('No active funding verified'));});

test('delete one or all reports persists without changing Strategy evidence',()=>{
 const main=structuredClone(fixture);const evidence=structuredClone(main.market.researchResults);
 main.market.researchReports=[Report.snapshot(main,'one'),Report.snapshot(main,'two')];
 assert.equal(Report.deleteSaved(main.market,'one'),1);
 assert.deepEqual(main.market.researchReports.map(x=>x.id),['two']);
 assert.equal(Report.deleteSaved(main.market,null),1);
 const reloaded=Market.normalizeMarketState(JSON.parse(JSON.stringify(main.market)));
 assert.deepEqual(reloaded.researchReports,[]);
 assert.equal(reloaded.researchReportsInitialized,true);
 assert.deepEqual(main.market.researchResults,evidence);
 main.market.researchReports=Report.append(reloaded.researchReports,Report.snapshot(main,'new'));
 assert.deepEqual(main.market.researchReports.map(x=>x.id),['new']);
});

test('report cards distinguish snapshot dates from evidence dates and escape titles',()=>{
 const one=Report.snapshot(fixture,'one');one.createdAt='2026-10-01T12:00:00Z';
 const two={...one,id:'two',createdAt:'2026-10-01T13:00:00Z'};
 const html=Report.historyHtml([two,one]);
 assert.ok(html.includes('Partial coverage'));assert.ok(html.includes('Evidence collected'));
 assert.ok(html.includes(Report.dateLabel(one.createdAt)));assert.ok(html.includes(Report.dateLabel(two.createdAt)));
 assert.ok(!html.includes('2026-10-01T12:00:00Z'));assert.ok(html.includes('data-report-delete="1"'));
 assert.equal(Report.dateLabel('broken'),'Date unavailable');
});
