const {test}=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js');
const candidate={company:'Wernedal & CO',domain:'wernedal-co.se',market:'Sweden',buyerFit:{reason:'Metal manufacturing supplier and technical evaluation'}};
const staff=`# Kontakt\n### Personal\n![Our technical staff](https://wernedal-co.se/team.jpg)\n\nArad Beck\nOrdermottagare/konstruktör\nTel. 08-761 76 70\n\nLars Olausson\nOrdermottagare/konstruktör\nTel. 08 50 10 37 28\n\nRikard Lejåker\nOrdermottagare/konstruktör\nTel. 08 50 10 37 23\n\nChrister Larsson\nPlatschef\nTel. 08 50 10 37 25\n\nJohnny Spång\nLogistik och leveranser\njohnny@wernedal-co.se\n\nCatrin Haglund\nAdministration\ncatrin@wernedal-co.se\n### Kontakta gärna oss idag\n`;
const row={url:'https://www.wernedal-co.se/kontakta-oss/',title:'Kontakta Wernedal & CO',markdown:staff,sourceRead:true};
function profile(c=candidate){const plan=D.buyerResearchPlan(c,{decisionMakers:'Operations; Production; Engineering Director'});return {companyDomain:c.domain,decisionMakers:plan.roles.join('; ')};}
test('official staff blocks produce source-backed operational and technical contacts without inventing seniority',()=>{
 const trace=D.tracePublicBuyers([row],candidate.company,profile());const names=trace.people.map(p=>p.name).sort();
 assert.deepEqual(names,['Arad Beck','Christer Larsson','Lars Olausson','Rikard Lejåker']);
 const site=trace.people.find(p=>p.name==='Christer Larsson');assert.equal(site.title,'Platschef');assert.equal(D.isExecutiveBuyer(site),false);
 for(const p of trace.people){assert.equal(p.publicNameUrl,row.url);assert.equal(p.organization,candidate.company);assert.equal(D.qualifyBuyer(p,profile(),candidate).eligible,true);assert.ok(D.qualifyBuyer(p,profile(),candidate).gaps.includes('Actual purchasing authority unconfirmed'));}
 const saved=D.normalizeDiscoveryState({selectedProspects:[{...candidate,buyerSearchMode:'user_selected_target',people:trace.people}]}).selectedProspects[0];assert.equal(saved.people.length,4);
});
test('official staff extraction is domain-bound and does not mislabel designers as directors or CEOs',()=>{
 assert.equal(D.tracePublicBuyers([{...row,url:'https://other.example/contact'}],candidate.company,profile()).people.length,0);
 const leaders=D.tracePublicBuyers([row],candidate.company,{companyDomain:candidate.domain,decisionMakers:'CEO'}).people;assert.equal(leaders.length,0);
 const c={...candidate,company:'Different Fabrication',domain:'different.example'};const renamed={...row,url:'https://different.example/contact',markdown:staff.replaceAll('wernedal-co.se','different.example')};assert.equal(D.tracePublicBuyers([renamed],c.company,profile(c)).people.length,4);
});
test('bounded coverage follow-up never creates the invalid over-600-character all-role query',()=>{
 const p={decisionMakers:'Executive leadership; Procurement Director; CEO/Owner; Team Leadership; Project Director; Operations; Production; Procurement; Engineering Director; Procurement Manager; Strategic Sourcing Manager; Purchasing Manager; Engineering Manager; Technical Manager; Operations Director; Plant Manager'};
 const plan=D.buyerCoveragePlan([],p,candidate);assert.ok(plan.queries.every(q=>q.length<=600),JSON.stringify(plan.queries.map(q=>q.length)));
});
test('contact-page testimonials and former staff cannot become current employees',()=>{
 const body='# Contact\n## Customer testimonials\nAnna Buyer\nCEO\n## Former staff\nErik Former\nPlant Manager\n';
 assert.equal(D.tracePublicBuyers([{...row,markdown:body}],candidate.company,{companyDomain:candidate.domain,decisionMakers:'CEO; Plant Manager'}).people.length,0);
});
