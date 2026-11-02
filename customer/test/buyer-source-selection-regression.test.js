const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js');
test('restricted social search hits do not consume contact source reads or fail completed searches',async()=>{
 const candidate={company:'Example',domain:'example.com',people:[{id:'p',name:'Alex Lind',publicName:'Alex Lind',title:'Procurement Director',organization:'Example',publicNameUrl:'https://example.com/team'}]},reads=[];
 const report=await D.runMandatoryBuyerResearch(candidate,{rows:[{url:'https://example.com/team',sourceRead:true,markdown:'Alex Lind\nProcurement Director'}],search:async()=>[{url:'https://www.instagram.com/p/contact-test/',description:'Example social update'}],readPage:async url=>{reads.push(url);throw Error('restricted social source');}});
 assert.ok(!reads.some(url=>url.includes('instagram.com')));assert.ok(!report.gaps.some(g=>g.includes('instagram.com')));
});
test('a corporate reference number in a named quote cannot become a confirmed phone',()=>{
 const now=new Date().toISOString(),url='https://example.com/team',candidate={domain:'example.com',company:'Example'},person={id:'p',name:'Alex Lind',title:'Procurement Director',organization:'Example',publicPhone:'921-4237-81',publicPhoneUrl:url,publicPhoneEvidence:{version:2,sourceKind:'official',sourceRead:true,url,checkedAt:now,quote:'Alex Lind Procurement Director 921-4237-81'},publicPhoneSourceCheck:{version:2,status:'attributed',url,checkedAt:now}};
 assert.equal(D.confirmedBuyerPhone(candidate,person),'');const matched=D.matchPublicBuyerDetails([{...person,publicPhone:'',publicPhoneEvidence:null}],[{url,sourceRead:true,markdown:'Alex Lind\nProcurement Director\n921-4237-81'}],candidate.domain,candidate.company)[0];assert.ok(!matched.publicPhone);
});
