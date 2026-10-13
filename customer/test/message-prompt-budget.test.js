const test=require('node:test'),assert=require('node:assert/strict');
const M=require('../message-studio.js');
const essentials={sender:'Alex Lane',company:'SellerCo',offer:'Installation',value:'Simplify delivery',meetingValue:'Project examples',calendly:'https://calendly.com/alex/intro'};
test('AI Original bounds duplicate scraped research below the server limit without changing stored evidence',()=>{
 const rows=Array.from({length:30},(_,i)=>({url:`https://seller.example/${i}`,status:'ok',extracted:true,text:'Relevant installation evidence. '.repeat(1200),rawHtml:'PRIVATE_RAW_HTML'.repeat(1200)}));
 const context={buyerCompany:'BuyerCo',buyerName:'Sam',sellerWebsite:'https://seller.example',trigger:{url:'https://buyer.example/news',verification:'source_verified',excerpt:'BuyerCo announced a new sorting plant.'},sellerEvidence:rows,profileEvidence:rows,buyerEvidence:{sources:rows,rawHtml:'BUYER_RAW_HTML'.repeat(2000)}};
 const before=JSON.stringify(context),result=M.prompt(M.normalize({mode:'original'},essentials),context),payload=JSON.parse(result.prompt);
 assert.ok(result.prompt.length<80000,`Request has ${result.prompt.length} characters`);
 assert.equal(payload.context.buyerCompany,'BuyerCo');assert.equal(payload.context.trigger.verification,'source_verified');assert.match(payload.context.trigger.excerpt,/sorting plant/);
 assert.ok(payload.context.sellerEvidence.some(row=>row.url===rows[0].url&&row.status==='ok'&&row.text));
 assert.doesNotMatch(result.prompt,/PRIVATE_RAW_HTML|BUYER_RAW_HTML/);assert.equal(JSON.stringify(context),before);
});
test('AI Original makes repetitions and contradictory event wording explicit quality constraints',()=>{
 const result=M.prompt(M.normalize({mode:'original'},essentials),{buyerCompany:'BuyerCo'});
 assert.match(result.system,/Do not repeat/);assert.match(result.system,/same.*terminology/);
});
