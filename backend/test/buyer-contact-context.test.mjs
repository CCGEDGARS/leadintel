import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
import {buyerJobsFixture,workspaceId,foreignWorkspaceId} from './buyer-research-jobs-fixture.mjs';
import {upsertCrmCompany,writeCrmRecord,getCrmCompany} from '../src/crm.js';
import {buyerContactOptions,loadBuyerContactContext} from '../src/buyer-contact-context.js';
import {researchBuyerContacts} from '../src/approved-workflow-runner.js';
const require=createRequire(import.meta.url),D=require('../../customer/discovery-engine.js');

test('research cohorts use only exact active CRM contacts in the authoritative workspace and company',async t=>{
 const f=await buyerJobsFixture(t),context={workspaceId,userId:f.users.owner.id,role:'owner'},company=(await upsertCrmCompany(f.env.DB,context,{company:'Forge Industries',domain:'forge.example'})).company;
 const candidate={company:'Forge Industries',domain:'forge.example',crmId:company.id,buyerSearchMode:'user_selected_target',buyerRoles:['Procurement Director'],people:['Alex Smith','Blair Jones','Cameron West','Drew North','Evan Green','Frank White','Grace Hall','Harper South'].map((name,i)=>({id:'p'+i,name,publicName:name,title:'Procurement Director',organization:'Forge Industries',publicNameUrl:'https://forge.example/team'}))};
 for(const p of candidate.people.slice(4))await writeCrmRecord(f.env.DB,context,"INSERT INTO crm_contacts(id,workspace_id,company_id,external_person_id,name,title,source,verification_provider,email_status,work_email,normalized_email,phone_number,phone_status,created_at,updated_at) VALUES(?,?,?,?,?,?,'treg','treg','verified',?,?,?,'verified',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",[p.id,workspaceId,company.id,p.id,p.name,p.title,p.name.toLowerCase().replace(' ','.')+'@forge.example',p.name.toLowerCase().replace(' ','.')+'@forge.example','+46701234567']);
 const {detail,contactOptions}=await loadBuyerContactContext(f.env,context,candidate);
 assert.deepEqual(D.mandatoryBuyerResearchPriorities(candidate.people,candidate,{forExecution:true,contactOptions}).map(p=>p.id),['p4','p5','p6','p7']);
 assert.equal(D.buyerQualityAssessment(candidate,{contactOptions}).confirmedPriorityContacts,4);
 const foreign=await upsertCrmCompany(f.env.DB,{workspaceId:foreignWorkspaceId,userId:f.users.foreign.id,role:'owner'},{company:'Forge Industries',domain:'forge.example'});
 assert.notEqual(foreign.company.id,company.id);
 const other=await loadBuyerContactContext(f.env,{workspaceId:foreignWorkspaceId},candidate);
 assert.deepEqual(D.mandatoryBuyerResearchPriorities(candidate.people,candidate,{forExecution:true,contactOptions:other.contactOptions}).map(p=>p.id),['p0','p1','p2','p3']);
 for(const patch of [d=>d.company.normalized_domain='other.example',d=>d.company.workspace_id=foreignWorkspaceId,d=>d.company.id='other',d=>d.contacts.forEach(c=>c.external_person_id='other'),d=>d.contacts.forEach(c=>c.name='Other Buyer'),d=>d.contacts.forEach(c=>c.title='Former Director'),d=>d.contacts.forEach(c=>c.public_linkedin_url='https://linkedin.com/in/other-person')]){
  const changed=structuredClone(detail);patch(changed);
  const people=structuredClone(candidate.people);for(const p of people)p.publicLinkedinUrl='https://linkedin.com/in/person-'+p.id;
  const c={...candidate,people},options=buyerContactOptions(c,context,changed);
  for(const p of people.slice(4)){assert.equal(options.confirmedEmail(p),'');assert.equal(D.confirmedBuyerPhone(c,p,options.contactForPerson(p),options),'');}
 }
 const claimed=structuredClone(candidate);for(const p of claimed.people.slice(4))p.contactData={provider:'treg',email:{status:'verified',address:'claimed@forge.example'},phone:{status:'verified',number:'+46701234567'}};
 const unbound=buyerContactOptions(claimed,context,null);assert.deepEqual(D.mandatoryBuyerResearchPriorities(claimed.people,claimed,{forExecution:true,contactOptions:unbound}).map(p=>p.id),['p0','p1','p2','p3']);
 const saved=await getCrmCompany(f.env.DB,context,company.id),withoutReads={DB:{prepare(){assert.fail('Existing authoritative detail should not be loaded again');}}};
 assert.equal((await loadBuyerContactContext(withoutReads,context,candidate,{detail:saved})).detail,saved);
 const stamp=new Date().toISOString(),page={url:'https://forge.example/team',sourceRead:true,extractedAt:stamp,markdown:candidate.people.map(p=>'### '+p.name+'\n'+p.title+'\nForge Industries').join('\n\n')};
 await researchBuyerContacts(candidate,async()=>[],async()=>{},async url=>({...page,url}),[page],{decisionMakers:'Procurement Director'},{},{env:f.env,workspaceId});
 assert.equal(D.buyerResearchCoveragePassed(candidate,{contactOptions}),true,'approved automatic workflow free research must complete the same CRM-displayed cohort as its later paid gate');
 for(const p of candidate.people.slice(4))assert.equal(p.contactResearch.checks.deep.status,'complete');
});

function channelParity(){
 const names=['Alex Smith','Blair Jones','Cameron West','Drew North','Evan Green','Frank White','Grace Hall','Harper South'];
 const candidate={company:'Forge Industries',domain:'forge.example',crmId:'company',buyerSearchMode:'user_selected_target',buyerRoles:['Procurement Director'],people:names.map((name,i)=>({id:'p'+i,name,publicName:name,title:'Procurement Director',organization:'Forge Industries',publicNameUrl:'https://forge.example/team'}))};
 const contact=(i,email)=>({id:'ct'+i+email,workspace_id:'workspace',company_id:'company',external_person_id:'p'+i,name:names[i],title:'Procurement Director',organization:'Forge Industries',source:'treg',email_status:'verified',normalized_email:email});
 const detail={company:{id:'company',workspace_id:'workspace',normalized_domain:'forge.example',company_name:'Forge Industries'},contacts:names.slice(4).map((name,i)=>contact(i+4,name.split(' ')[0].toLowerCase()+'@forge.example'))};
 const source=fs.readFileSync(require.resolve('../../customer/discovery-ui.js'),'utf8'),ctx={LeadIntelDiscovery:D,canonicalDomain:D.canonicalDomain,bridge:()=>({workspace:{id:'workspace'}}),crmCompanyByDomain:()=>detail.company,window:{LeadIntelContactPolicy:globalThis.LeadIntelContactPolicy}};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function buyerHydrationScope('),source.indexOf('function hydrateLocalPipelineFromCrm(')),ctx);vm.runInContext(source.slice(source.indexOf('function verifiedBuyerEmail('),source.indexOf('async function saveListedBuyerEmail(')),ctx);
 return {candidate,detail,contact,ui:person=>ctx.verifiedBuyerEmail(candidate,person,ctx.buyerHydrationContact(candidate,person,detail)||{}),options:()=>buyerContactOptions(candidate,{workspaceId:'workspace'},detail)};
}
test('backend cohort follows actual browser hydration when accepted CRM email addresses are ambiguous',()=>{
 const f=channelParity();f.detail.contacts.unshift(f.contact(0,'alex@forge.example'),f.contact(0,'alex.smith@forge.example'));
 assert.equal(f.ui(f.candidate.people[0]),'');assert.equal(f.options().confirmedEmail(f.candidate.people[0]),'');
 assert.deepEqual(D.mandatoryBuyerResearchPriorities(f.candidate.people,f.candidate,{forExecution:true,contactOptions:f.options()}).map(p=>p.id),['p4','p5','p6','p7']);
});
test('known rejected or archived CRM email records cannot be bypassed by a retained public listing',()=>{
 for(const status of ['invalid','undeliverable','bounced','rejected','suppressed','archived']){
  const f=channelParity(),p=f.candidate.people[0],row=f.contact(0,'alex@forge.example');Object.assign(p,{publicEmail:'alex@forge.example',publicEmailUrl:'https://directory.example/alex-smith'});
  if(status==='archived')row.archived_at=new Date().toISOString();else row.email_status=status;f.detail.contacts.unshift(row);
  assert.equal(f.ui(p),'',status+' holds the actual browser email');assert.equal(f.options().confirmedEmail(p),'',status+' holds backend email');
  row.phone_number='+46701234567';row.phone_status='verified';
  assert.equal(Boolean(D.confirmedBuyerPhone(f.candidate,p,f.options().contactForPerson(p),f.options())),status!=='archived','independently verified phone retains its own gate');
 }
 const f=channelParity(),p=f.candidate.people[0];Object.assign(p,{publicEmail:'alex@forge.example',publicEmailUrl:'https://directory.example/alex-smith'});f.detail.contacts.unshift({...f.contact(0,'different@forge.example'),email_status:'public_unverified'});
 assert.equal(f.ui(p),'');assert.equal(f.options().confirmedEmail(p),'','public fallback cannot override a different saved address');
});
test('backend CRM channel binding rejects every conflicting profile alias used by actual browser hydration',()=>{
 for(const [owner,key]of [['person','linkedinUrl'],['person','linkedin'],['person','linkedinConfirmedUrl'],['person','profile'],['contact','linkedin'],['contact','linkedinConfirmedUrl']]){
  const f=channelParity(),p=f.candidate.people[0],row=f.contact(0,'alex@forge.example');p.publicLinkedinUrl='https://linkedin.com/in/alex-smith';
  (owner==='person'?p:row)[key]=key==='profile'?{linkedinUrl:'https://linkedin.com/in/other'}:'https://linkedin.com/in/other';f.detail.contacts.unshift(row);
  assert.equal(f.ui(p),'',owner+' '+key);assert.equal(f.options().confirmedEmail(p),'',owner+' '+key);
 }
});
test('CRM employer and domain binding retain legal company-name aliases accepted by the actual browser',()=>{
 for(const company of ['Forge Industries','Forge Industries Inc']){
  const f=channelParity(),p=f.candidate.people[4];f.candidate.company=company;p.organization='Forge Industries Inc';f.detail.contacts[0].organization=p.organization;
  assert.equal(f.ui(p),'evan@forge.example');assert.equal(f.options().confirmedEmail(p),'evan@forge.example');
 }
});
test('a unique authoritative canonical CRM email without an external ID retains actual browser identity binding',()=>{
 const f=channelParity(),p=f.candidate.people[4];delete f.detail.contacts[0].external_person_id;
 assert.equal(f.ui(p),'evan@forge.example');assert.equal(f.options().confirmedEmail(p),'evan@forge.example');
 f.detail.contacts[0].external_person_id='another-person';assert.equal(f.ui(p),'');assert.equal(f.options().confirmedEmail(p),'');
});
