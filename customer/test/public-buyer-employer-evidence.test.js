const {test}=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js');
// 23.10 live defect: the target "Automation" (balticautomation.com) was shown with "Peter Hantman · CEO at Tungsten"
// and "Jim Harold · CEO at Identity" — executives of other companies whose names merely end with the target's word.
const candidate={company:'Automation',domain:'balticautomation.com',market:'Latvia'};
const profile={companyDomain:candidate.domain,decisionMakers:'CEO; Managing Director'};
test('a result whose employer merely ends with the truncated target name is not attached to the target',()=>{
 const rows=[
  {url:'https://www.linkedin.com/in/peter-hantman',title:'Peter Hantman - CEO at Tungsten Automation | LinkedIn',description:'Peter Hantman. CEO at Tungsten Automation. Irvine, California, United States.'},
  {url:'https://www.linkedin.com/in/jim-harold',title:'Jim Harold - Chief Executive Officer at Identity Automation | LinkedIn',description:'Jim Harold. Chief Executive Officer at Identity Automation. Houston, Texas.'}
 ];
 const trace=D.tracePublicBuyers(rows,candidate.company,profile);
 assert.deepEqual(trace.people.map(p=>p.name),[]);
 assert.ok(trace.diagnostics.length===2&&trace.diagnostics.every(d=>d.companyVerification==='rejected'),JSON.stringify(trace.diagnostics));
});
test('the domain brand rescues a buyer whose employer carries the full company name the target truncated',()=>{
 const rows=[{url:'https://www.linkedin.com/in/anna-berzina',title:'Anna Bērziņa - CEO at Baltic Automation | LinkedIn',description:'Anna Bērziņa. CEO at Baltic Automation SIA. Riga, Latvia.'}];
 const trace=D.tracePublicBuyers(rows,candidate.company,profile);
 assert.equal(trace.people.length,1,JSON.stringify(trace.diagnostics));
 const person=trace.people[0];
 assert.equal(person.title,'CEO');
 assert.equal(person.organization,'Baltic Automation','the evidenced employer, not the truncated target label');
 const q=D.qualifyBuyer(person,profile,candidate);
 assert.equal(q.breakdown.employer.points,10,JSON.stringify(q));
 assert.ok(!q.gaps.includes('Employer mismatch'));
});
test('an exact target employer after a preposition or separator still passes',()=>{
 const c={company:'Baltic Automation',domain:'balticautomation.com'},p={companyDomain:c.domain,decisionMakers:'CEO'};
 const rows=[{url:'https://www.linkedin.com/in/anna-berzina',title:'Anna Bērziņa - CEO at Baltic Automation | LinkedIn',description:'Anna Bērziņa. CEO at Baltic Automation.'},
  {url:'https://www.linkedin.com/in/juris-ozols',title:'Juris Ozols - Managing Director - Baltic Automation | LinkedIn',description:'Juris Ozols. Managing Director. Baltic Automation.'}];
 const people=D.tracePublicBuyers(rows,c.company,{...p,decisionMakers:'CEO; Managing Director'}).people;
 assert.deepEqual(people.map(x=>[x.name,x.title,x.organization]).sort(),[['Anna Bērziņa','CEO','Baltic Automation'],['Juris Ozols','Managing Director','Baltic Automation']]);
});
