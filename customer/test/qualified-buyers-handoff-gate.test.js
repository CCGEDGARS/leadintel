const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
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

test('Buyer research does not let stale CRM membership bypass the current handoff',()=>{
 const start=ui.indexOf('async function findPotentialDecisionMakers');
 const end=ui.indexOf('async function selectTargetForBuyers',start);
 const block=ui.slice(start,end);
 assert.doesNotMatch(block.slice(0,block.indexOf('return searchDecisionMakers')),/crmCompanyByDomain/);
 assert.match(block,/allowCrmSync:Boolean\(crmCompanyByDomain\(domain\)\)/);
 assert.match(block,/Buyer search needs a company selected in the current Companies step/);
});

test('manual current targets remain allowed without pretending they are qualified',()=>{
 const start=ui.indexOf('async function findPotentialDecisionMakers');
 const end=ui.indexOf('async function selectTargetForBuyers',start);
 const block=ui.slice(start,end);
 assert.match(block,/explicitSelectedTarget/);
 assert.match(block,/user_selected_target/);
 assert.match(block,/user_selected_without_signal/);
});
