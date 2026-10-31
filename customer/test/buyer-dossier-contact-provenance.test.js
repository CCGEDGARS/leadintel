const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../discovery-engine.js'),UI=require('../company-dossier-ui.js');
const url='https://example.com/team',quote='Anna Andersson — Head of Procurement — Example. Phone: +371 2211 3344';
test('dossier quote excerpts are retained as context rather than fabricated current full-page reads',()=>{
 const dossier={domain:'example.com',people:[{name:'Anna Andersson',title:'Head of Procurement',sourceUrl:url,quote}],facts:[],channels:[],passes:[{sourceReads:[{url,status:'succeeded',checkedAt:new Date(Date.now()-40*86400000).toISOString()}]}]};
 const rows=UI.evidenceRows(dossier);assert.equal(rows.length,1);assert.ok(rows[0].markdown.includes(quote));assert.equal(rows[0].sourceRead,false);
 const candidate={company:'Example',domain:'example.com',people:[{id:'anna',name:'Anna Andersson',title:'Head of Procurement',organization:'Example',publicNameUrl:url}]};candidate.people=D.matchPublicBuyerDetails(candidate.people,rows,candidate.domain,candidate.company);
 assert.equal(D.confirmedBuyerPhone(candidate,candidate.people[0]),'');assert.equal(candidate.people[0].publicPhone||'','');
});
test('a genuine full page read can confirm the same phone without changing dossier context',async()=>{
 const candidate={company:'Example',domain:'example.com',people:[{id:'anna',name:'Anna Andersson',title:'Head of Procurement',organization:'Example',publicNameUrl:url}]};
 const history=UI.evidenceRows({domain:'example.com',people:[{sourceUrl:url,quote}],facts:[],channels:[]});let reads=0;
 await D.runMandatoryBuyerResearch(candidate,{rows:history,search:async()=>[],readPage:async()=>{reads++;return {url,markdown:quote};}});
 assert.equal(reads,1);assert.equal(D.confirmedBuyerPhone(candidate,candidate.people[0]),'+371 2211 3344');
});
