const test=require('node:test'),assert=require('node:assert/strict'),M=require('../company-lists.js'),D=require('../discovery-engine.js');
test('search snapshot includes the full deduplicated inventory and preserves previous, pending and current scores without mutating research',()=>{
 const rows=Array.from({length:31},(_,i)=>({company:'Factory '+i,domain:'factory'+i+'.example',market:'Sweden',qualification:{qualificationKind:'company',score:i?90-i:null,commercial:{},eligible:true},needsRecheck:i%2===0,evidence:[{url:'https://factory'+i+'.example/news',quote:'Exact source evidence '+i}],people:[{id:'not-exported',name:'Saved buyer'}]}));
 const discovery={candidates:rows.slice(0,12),potentialMatches:rows.slice(12),selectedProspects:[rows[0]]},before=JSON.stringify(discovery),view=D.rankCompanyResults(discovery);
 const snapshot=M.searchSnapshot(view,{markets:['Sweden'],signals:['Expansion'],sellerWebsite:'https://seller.example/'});
 assert.equal(view.visible.length,10);assert.equal(snapshot.rows.length,31);assert.equal(new Set(snapshot.rows.map(r=>r.company)).size,31);
 assert.ok(snapshot.rows.some(r=>r.scoreState==='current'&&r.reviewStatus==='Checked'));assert.ok(snapshot.rows.some(r=>r.scoreState==='previous'&&r.reviewStatus==='Needs review'));assert.ok(snapshot.rows.some(r=>r.score===null&&r.scoreState==='pending'));
 assert.equal(JSON.stringify(discovery),before);assert.deepEqual(M.normalizeSearchSnapshot(snapshot),snapshot);
 const list={name:'=Unsafe()',criteria:{kind:'search_snapshot',context:snapshot.context},results:snapshot.rows},csv=M.csv(list),xlsx=new TextDecoder().decode(M.xlsx(list));
 assert.match(csv,/Previous · needs review/);assert.match(csv,/Awaiting score/);assert.match(csv,/Exact source evidence 30/);assert.match(csv,/'=Unsafe/);assert.match(csv,/Unconfirmed/);assert.doesNotMatch(csv,/not-exported/);assert.match(xlsx,/Factory 30/);assert.doesNotMatch(xlsx,/<f>/);
});
test('invalid, oversized and empty snapshots cannot become saved lists; unsafe links and invented zero scores stay out',()=>{
 for(const rows of [[],null,Array(1001).fill({company:'A'}),[{}]])assert.throws(()=>M.normalizeSearchSnapshot({rows}));
 const row=M.normalizeSearchSnapshot({rows:[{company:'=Formula',website:'javascript:alert(1)',score:null,scoreState:'current',reviewStatus:'Checked',evidence:[{url:'https://valid.example/',quote:'Evidence'},{url:'javascript:bad'}]}]}).rows[0];
 assert.equal(row.website,'');assert.equal(row.score,null);assert.equal(row.reviewStatus,'Needs review');assert.equal(row.evidence.length,1);
});

test('saving a browser snapshot preserves its fingerprint when text ends at a length limit',()=>{
 const atLimit=n=>'x'.repeat(n-1)+' more';
 const snapshot=M.normalizeSearchSnapshot({context:{markets:[atLimit(120)],signals:[atLimit(160)]},
  rows:[{company:atLimit(180),location:atLimit(300),signals:[atLimit(160)],summary:atLimit(2000),checkedAt:atLimit(80),
   evidence:[{url:'https://factory.example/',quote:atLimit(2000),date:atLimit(80)}]}]});
 assert.deepEqual(M.normalizeSearchSnapshot(JSON.parse(JSON.stringify(snapshot))),snapshot);
});
