import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultAutomationPolicy,normalizeAutomationPolicy,localClockParts,isWithinSendWindow,nextEnabledWindow,boundedDelayMinutes,evaluateAutomaticSend
} from '../src/outreach-automation.js';

test('automation policy defaults to manual and off with conservative limits',()=>{
  const p=defaultAutomationPolicy();
  assert.equal(p.mode,'manual');assert.equal(p.enabled,false);assert.equal(p.paused,false);assert.equal(p.emergencyStop,false);
  assert.equal(p.workspaceDailyLimit,20);assert.equal(p.mailboxDailyLimit,20);assert.deepEqual(p.workingDays,[1,2,3,4,5]);
  assert.equal(p.timezone,'Europe/Riga');assert.equal(p.sendWindowStart,'09:00');assert.equal(p.sendWindowEnd,'16:30');
  assert.equal(p.minDelayMinutes,8);assert.equal(p.maxDelayMinutes,18);assert.equal(p.maxFollowups,2);assert.deepEqual(p.followupDelaysDays,[3,7]);
});

test('policy normalization rejects unsafe malformed automatic settings',()=>{
  assert.throws(()=>normalizeAutomationPolicy({mode:'automatic',enabled:true,workspaceDailyLimit:0}),/workspace daily limit/i);
  assert.throws(()=>normalizeAutomationPolicy({mode:'automatic',enabled:true,mailboxDailyLimit:-1}),/mailbox daily limit/i);
  assert.throws(()=>normalizeAutomationPolicy({mode:'automatic',enabled:true,minDelayMinutes:20,maxDelayMinutes:5}),/maximum delay/i);
  assert.throws(()=>normalizeAutomationPolicy({mode:'automatic',enabled:true,timezone:'Mars\/Olympus'}),/timezone/i);
  assert.throws(()=>normalizeAutomationPolicy({mode:'automatic',enabled:true,sendWindowStart:'18:00',sendWindowEnd:'09:00'}),/send window/i);
});

test('normalization preserves explicit valid automatic owner configuration',()=>{
  const p=normalizeAutomationPolicy({mode:'automatic',enabled:true,workspaceDailyLimit:20,mailboxDailyLimit:20,workingDays:[1,2,3,4,5],timezone:'Europe/Riga',sendWindowStart:'09:00',sendWindowEnd:'16:30',minDelayMinutes:8,maxDelayMinutes:18,maxFollowups:2,followupDelaysDays:[3,7],replyPollIntervalMinutes:60});
  assert.equal(p.mode,'automatic');assert.equal(p.enabled,true);assert.equal(p.workspaceDailyLimit,20);
});

test('local clock and send window honor Europe/Riga timezone and local midnight',()=>{
  const p={...defaultAutomationPolicy(),mode:'automatic',enabled:true};
  const inside=new Date('2026-09-08T08:30:00Z');
  const parts=localClockParts(inside,'Europe/Riga');
  assert.equal(parts.hour,11);assert.equal(parts.minute,30);assert.equal(parts.weekday,2);
  assert.equal(isWithinSendWindow(p,inside),true);
  assert.equal(isWithinSendWindow(p,new Date('2026-09-08T04:30:00Z')),false);
  const afterUtcMidnight=localClockParts(new Date('2026-09-07T21:30:00Z'),'Europe/Riga');
  assert.equal(afterUtcMidnight.day,8);
});

test('weekends are disabled and next window moves to Monday local time',()=>{
  const p={...defaultAutomationPolicy(),mode:'automatic',enabled:true};
  const saturday=new Date('2026-09-12T09:00:00Z');
  assert.equal(isWithinSendWindow(p,saturday),false);
  const next=new Date(nextEnabledWindow(p,saturday));
  const parts=localClockParts(next,'Europe/Riga');
  assert.equal(parts.weekday,1);assert.equal(parts.hour,9);assert.equal(parts.minute,0);
});

test('bounded delay is deterministic and remains inside inclusive bounds',()=>{
  const p={...defaultAutomationPolicy(),minDelayMinutes:8,maxDelayMinutes:18};
  assert.equal(boundedDelayMinutes(p,()=>0),8);
  assert.equal(boundedDelayMinutes(p,()=>0.5),13);
  assert.equal(boundedDelayMinutes(p,()=>0.999999),18);
});

const eligibleContext=(overrides={})=>({
  policy:{...defaultAutomationPolicy(),mode:'automatic',enabled:true},now:new Date('2026-09-08T08:30:00Z'),recipient:'buyer@example.com',suppressed:false,replyStopped:false,workspaceSentToday:0,mailboxSentToday:0,lastAutomaticSentAt:null,...overrides
});

test('eligibility fails closed for every safety boundary',()=>{
  const cases=[
    [{policy:{...defaultAutomationPolicy(),mode:'manual',enabled:false}},'manual_mode'],
    [{policy:{...defaultAutomationPolicy(),mode:'automatic',enabled:false}},'disabled'],
    [{policy:{...defaultAutomationPolicy(),mode:'automatic',enabled:true,paused:true}},'paused'],
    [{policy:{...defaultAutomationPolicy(),mode:'automatic',enabled:true,emergencyStop:true}},'emergency_stop'],
    [{suppressed:true},'suppressed'],
    [{recipient:'bad-email'},'invalid_recipient'],
    [{replyStopped:true},'reply_stopped'],
    [{workspaceSentToday:20},'workspace_daily_limit'],
    [{mailboxSentToday:20},'mailbox_daily_limit'],
    [{now:new Date('2026-09-12T09:00:00Z')},'disabled_weekday'],
    [{now:new Date('2026-09-08T04:30:00Z')},'outside_window'],
    [{lastAutomaticSentAt:new Date('2026-09-08T08:25:00Z'),policy:{...defaultAutomationPolicy(),mode:'automatic',enabled:true,minDelayMinutes:8,maxDelayMinutes:18}},'minimum_spacing']
  ];
  for(const [override,reason] of cases){const result=evaluateAutomaticSend(eligibleContext(override));assert.equal(result.allowed,false,reason);assert.equal(result.reason,reason);}
});

test('fully eligible automatic send is allowed',()=>{
  const result=evaluateAutomaticSend(eligibleContext());
  assert.deepEqual(result,{allowed:true,reason:'eligible',nextEligibleAt:null});
});
