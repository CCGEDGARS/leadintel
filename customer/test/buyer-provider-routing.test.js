const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../discovery-ui.js'),'utf8');
function runtime(authenticated){
 const requests=[];
 const start=source.indexOf('async function fetchFirecrawlBuyerResearch('),end=source.indexOf('function patternListings(',start);
 assert.ok(start>=0,'shared workspace Buyer Firecrawl transport is required');
 const context={LEADINTEL_API:'https://api.example',INTELLIGENCE_PROXY:'https://managed.example',crmAuthenticated:()=>authenticated,bridge:()=>({workspace:{id:'workspace / one'}}),fetchBuyerResearch:async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>({data:{web:[{url:'https://lkab.com',title:'Buyer'}]}})};},buyerResponseFailure:async()=>({message:'failed'}),publicSearchRows:value=>value.data.web};
 vm.createContext(context);vm.runInContext(source.slice(start,end)+'\nthis.search=searchBuyerPublicPages;this.transport=fetchFirecrawlBuyerResearch;',context);return {context,requests};
}
test('authenticated Buyer search uses the same workspace Firecrawl credential as Settings',async()=>{
 const {context,requests}=runtime(true),signal=new AbortController().signal;
 assert.equal((await context.search('LKAB procurement',8,signal)).length,1);
 assert.equal(requests[0].url,'https://api.example/api/integrations/services/firecrawl/search?workspace_id=workspace%20%2F%20one');
 assert.equal(requests[0].options.headers['X-LeadIntel-Research-Mode'],undefined);assert.equal(requests[0].options.credentials,'include');assert.equal(requests[0].options.signal,signal);
 assert.equal(JSON.parse(requests[0].options.body).query,'LKAB procurement');
});
test('local Buyer research retains managed proxy without workspace credentials',async()=>{
 const {context,requests}=runtime(false);await context.search('LKAB',4);
 assert.equal(requests[0].url,'https://managed.example/firecrawl-search');assert.equal(requests[0].options.credentials,undefined);
});
test('buyer page extraction also uses the authenticated workspace route',async()=>{
 const {context,requests}=runtime(true);await context.transport('scrape',{url:'https://lkab.com/contact',formats:['markdown']});
 assert.match(requests[0].url,/\/firecrawl\/scrape\?workspace_id=/);
});
