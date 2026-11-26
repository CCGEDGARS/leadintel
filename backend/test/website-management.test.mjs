import test from 'node:test';
import assert from 'node:assert/strict';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';
import {upsertCrmCompany} from '../src/crm.js';
import {startWebsiteContacts,readWebsiteContacts,publicWebsiteContacts} from '../src/website-contact-store.js';
import {runWebsiteContactJobs} from '../src/website-contact-runner.js';
import {managementLimit,managementShortlist,searchManagementIndex} from '../src/website-management.js';

test('shortlist checks published channels, excludes payroll and reuses a completed run',async t=>{
 for(const limit of [0,11,1.5])assert.throws(()=>managementLimit(limit));
 const f=await buyerJobsFixture(t),context={workspaceId,userId:f.users.owner.id,role:'owner',sessionHash:f.users.owner.sessionTokenHash};
 const detail=await upsertCrmCompany(f.DB,context,{company_name:'Finance Group',website:'https://finance.example/'});
 const body={action:'shortlist',companyId:detail.company.id,managementLimit:2};
 const job=await startWebsiteContacts(f.env,context,body);
 const reads=[];
 const services={read:async url=>{reads.push(url);return {url,title:'Finance Group',markdown:url.endsWith('/team')?'# Finance Group team\n## Anna Andersson\n### Production Manager\nEmail: anna@finance.example\nPhone: 12345678\n[LinkedIn](https://www.linkedin.com/in/anna-andersson/)\nEmail: anna.work@gmail.com\n## Maria Jensen\n### Payroll & Administration\nEmail: maria@finance.example':'# Finance Group\nFinance Group provides financial services.',links:['https://finance.example/team']};}};
 let row;
 for(let i=0;i<4;i++){await runWebsiteContactJobs(f.env,{jobId:job.id,services});row=await readWebsiteContacts(f.env,workspaceId,{id:job.id});if(row.status==='complete')break;}
 const result=publicWebsiteContacts(row);assert.equal(result.status,'complete',JSON.stringify(result));assert.deepEqual(result.people.map(p=>p.name),['Anna Andersson']);
 const [anna]=result.people;assert.equal(anna.publishedStaffCard.email,'anna@finance.example');assert.equal(anna.publishedStaffCard.phone,'12345678');assert.match(anna.publicLinkedinUrl,/anna-andersson/);assert.equal(anna.gmailMatches[0]?.email,'anna.work@gmail.com');assert.equal(anna.paidReadiness.eligible,true);assert.equal(reads.length,2);
 assert.equal((await startWebsiteContacts(f.env,context,body)).id,job.id);
 assert.ok(JSON.parse(row.state_json).tasks.every(t=>t.kind==='read'));
});
test('cap and preferences apply before individual research',()=>{
 const names=['Anna Black','Bert Olsen','Cecilia Lind','David Brown','Erik Berg','Felix Turner','Grace Moore','Hugo Allen','Iris Green','John Wilson','Karen White','Laura Gray'];
 const roster=names.map((name,i)=>({name,title:i===10?'Project Manager':i===11?'Payroll & Administration':'Production Manager',publicNameUrl:'https://finance.example/team',identityOrigin:'official'}));
 const chosen=managementShortlist(roster,10,'Project Manager');
 assert.equal(chosen.length,10);assert.equal(chosen[0].name,'Karen White');assert.ok(!chosen.some(p=>p.name==='Laura Gray'));
 assert.equal(managementShortlist(roster,1,'Project Manager').length,1);
});
test('index results keep the matching profile and snippet together',async()=>{
 const read=async()=>({data:{markdown:'# Results\n## [Anna Black - Finance Group](https://duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.linkedin.com%2Fin%2Fanna-black%2F)\nProduction manager at Finance Group\n## [Bert Olsen - Finance Group](https://finance.example/team/bert)\nDirector'}});
 const [first,second]=await searchManagementIndex('Anna Black',undefined,read);
 assert.match(first.url,/linkedin.com\/in\/anna-black/);assert.doesNotMatch(first.description,/Bert/);assert.match(second.description,/Director/);
});
