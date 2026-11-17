const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),M=require('../event-campaigns.js');
const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8'),code=source.slice(source.indexOf('async function discoverCampaign('),source.indexOf('function initDiscovery()'));
const event={id:'forum',name:'Industry Forum',startDate:'2099-10-10',endDate:'2099-10-12',country:'Denmark',audience:'Industrial partners'};
function harness(mode,{complete=true}={}){
 const saved=[],context={eventCampaigns:{campaigns:[{...event,audienceMode:mode}]}},bridge={saveCrmCompany:async p=>{saved.push(p);return {ok:true,company:{id:p.domain}};}};
 const rows=[{company:'Listed Partner',domain:'listed.test',website:'https://listed.test',qualification:{eligible:true},evidence:[{url:'https://forum.test/exhibitors',text:'Industry Forum 2099-10-10 exhibitors: Listed Partner',verified:true,checkedAt:'2099-01-01'}]},{company:'Outside Partner',domain:'outside.test',qualification:{eligible:true},evidence:[]},{company:'Excluded Partner',domain:'excluded.test',qualification:{eligible:false},evidence:[]}];
 const w={LeadIntelEventCampaigns:M,LeadIntelCrm:{mapDiscoveryCandidateToCrm:c=>c}};
 const run=new Function('window','crmAuthenticated','bridge','discoveryOperationContext','openCampaignResearch','mainState','runCompanyDiscovery','discovery','canonicalDomain',code+';return discoverCampaign;')(w,()=>true,()=>bridge,()=> 'workspace-one',async()=>true,()=>context,async({campaignPlan})=>{campaignPlan.results=rows;return complete;},{status:'ready'},s=>String(s||'').toLowerCase());return {run,saved};
}
for(const mode of ['participants','outside','both'])test(mode+' campaign retains only qualified requested companies and edition-bound participant evidence',async()=>{
 const h=harness(mode),result=await h.run({eventCampaignId:event.id,targetCount:2,researchDepth:'basic'});
 assert.deepEqual(result.map(c=>c.domain),mode==='participants'?['listed.test']:['listed.test','outside.test']);assert.equal(result[0].attendance.status,'company');assert.equal(result.find(c=>c.domain==='outside.test')?.attendance.status,mode==='participants'?undefined:'unknown');assert.equal(h.saved.length,result.length);
});
test('failed campaign discovery cannot silently save or fill the requested audience',async()=>{const h=harness('both',{complete:false});await assert.rejects(h.run({eventCampaignId:event.id,targetCount:10}),/incomplete/);assert.equal(h.saved.length,0);});
test('combined campaign excludes existing companies and respects the remaining target',async()=>{const h=harness('both');const result=await h.run({eventCampaignId:event.id,targetCount:1,exclude:['listed.test']});assert.deepEqual(result.map(c=>c.domain),['outside.test']);assert.equal(h.saved.length,1);});
