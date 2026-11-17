const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const D=require('../discovery-engine.js');
const ui=fs.readFileSync(path.join(__dirname,'../discovery-ui.js'),'utf8');

test('Buyer research trusts the current qualified Companies handoff',()=>{
 const start=ui.indexOf('async function findPotentialDecisionMakers');
 const end=ui.indexOf('async function selectTargetForBuyers',start);
 const block=ui.slice(start,end);
 assert.match(block,/const currentHandoff=buyerSelectionRows\(\)/);
 assert.match(block,/const currentQualified=.*candidateIsActionable/);
 assert.match(block,/authoritativeQualifiedHandoff=Boolean\(currentHandoff&&currentQualified\)/);
 assert.match(block,/candidate\.buyerSearchMode="user_selected_qualified"/);
});

test('Buyer research does not let stale CRM membership bypass the current handoff',async()=>{
 const start=ui.indexOf('async function findPotentialDecisionMakers');
 const end=ui.indexOf('async function restoreCompanyBeforeBuyerStart',start),candidate={company:'Old company',domain:'old.example'},calls=[];
 const c={discovery:{selectedProspects:[],candidates:[],potentialMatches:[candidate]},canonicalDomain:D.canonicalDomain,buyerSelectionRows:()=>[],candidateIsActionable:()=>false,LeadIntelDiscovery:D,crmCompanyByDomain:()=>{calls.push('crm');return {id:'old-crm',normalized_domain:'old.example'};},restoreCompanyBeforeBuyerStart:async()=>{calls.push('restore');return true;},searchDecisionMakers:async()=>{calls.push('research');return true;},renderAll(){},showToast:message=>calls.push(message)};
 vm.createContext(c);vm.runInContext(ui.slice(start,end),c);
 assert.equal(await c.findPotentialDecisionMakers(candidate.domain),false);
 assert.deepEqual(calls,['Buyer search needs a company selected in the current Companies step']);
 assert.equal(candidate.people,undefined);
});

test('manual current targets remain allowed without pretending they are qualified',()=>{
 const start=ui.indexOf('async function findPotentialDecisionMakers');
 const end=ui.indexOf('async function selectTargetForBuyers',start);
 const block=ui.slice(start,end);
 assert.match(block,/explicitSelectedTarget/);
 assert.match(block,/user_selected_target/);
 assert.match(block,/user_selected_without_signal/);
});
