import test from 'node:test';
import assert from 'node:assert/strict';
import {companyPacingDecision} from '../src/company-contact-pacing.js';
const now='2026-10-19T12:00:00.000Z';
test('first company contact is eligible',()=>assert.equal(companyPacingDecision({now}).allowed,true));
test('second contact waits five full days',()=>{
 const v=companyPacingDecision({contactsSent:1,lastInitialSentAt:now,now:'2026-10-23T12:00:00.000Z'});
 assert.equal(v.code,'COMPANY_COOLDOWN');assert.equal(v.nextEligibleAt,'2026-10-24T12:00:00.000Z');
 assert.equal(companyPacingDecision({contactsSent:1,lastInitialSentAt:now,now:'2026-10-24T12:00:00.000Z'}).allowed,true);
});
test('third contact reaches cap; fourth never eligible',()=>assert.equal(companyPacingDecision({contactsSent:3,now}).code,'COMPANY_CONTACT_CAP'));
test('unknown prior-contact date fails closed',()=>assert.equal(companyPacingDecision({contactsSent:1,now}).code,'COMPANY_CONTACT_HISTORY_INCOMPLETE'));
test('invalid policy and timestamps are rejected',()=>{
 assert.throws(()=>companyPacingDecision({now,policy:{maxContacts:0,minDaysBetweenInitial:5}}));
 assert.throws(()=>companyPacingDecision({now:'invalid'}));
});
