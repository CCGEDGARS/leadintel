const test=require('node:test');
const assert=require('node:assert/strict');
const crm=require('../crm-engine.js');

test('discovery candidate maps into compact durable CRM payload',()=>{
  const candidate={company:'Acme',domain:'www.acme.example',website:'https://www.acme.example/',market:'Sweden',score:{fit:25,signal:20,evidence:18,timing:12,value:8,total:83},confidence:'High',matchedSignals:[{name:'Expansion',matchedTerms:['new factory']}],evidence:[{url:'https://acme.example/news',title:'Factory'}],people:[{id:'apollo-1',name:'Anna Buyer',title:'Procurement Director',email:'anna@acme.example'}]};
  const payload=crm.mapDiscoveryCandidateToCrm(candidate,{pipelineStage:'Discovered'});
  assert.equal(payload.company.company_name,'Acme');
  assert.equal(payload.company.domain,'acme.example');
  assert.equal(payload.company.pipeline_stage,'Discovered');
  assert.equal(payload.company.opportunity_score,83);
  assert.equal(payload.contacts[0].external_person_id,'apollo-1');
  assert.equal(payload.contacts[0].work_email,'anna@acme.example');
  assert.equal(payload.intelligence.matched_signals.length,1);
  assert.equal(payload.intelligence.evidence.length,1);
});

test('legacy Contact Found stage migrates safely to Qualified',()=>{
  assert.equal(crm.normalizeCrmStage('Contact Found'),'Qualified');
  const payload=crm.mapLocalPipelineItemToCrm({company:'Acme',domain:'acme.example',stage:'Contact Found'});
  assert.equal(payload.company.pipeline_stage,'Qualified');
});

test('CRM filtering supports lifecycle, pipeline and company/contact search projection',()=>{
  const companies=[
    {id:'1',company_name:'Acme',normalized_domain:'acme.example',lifecycle_status:'prospect',pipeline_stage:'Qualified',contact_search:'Anna Buyer anna@acme.example'},
    {id:'2',company_name:'Beta',normalized_domain:'beta.example',lifecycle_status:'customer',pipeline_stage:'Won',contact_search:'Bob CEO'}
  ];
  assert.equal(crm.filterCrmCompanies(companies,{q:'anna'}).length,1);
  assert.equal(crm.filterCrmCompanies(companies,{lifecycle:'customer'}).length,1);
  assert.equal(crm.filterCrmCompanies(companies,{pipeline:'active'}).length,2);
});

test('suppressed CRM companies are never considered normal outreach targets',()=>{
  assert.equal(crm.isSuppressed({lifecycle_status:'suppressed'}),true);
  assert.equal(crm.isSuppressed({lifecycle_status:'prospect'}),false);
});
