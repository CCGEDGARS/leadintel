import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAutomationPolicy,localClockParts,isWithinSendWindow} from '../src/outreach-automation.js';
test('Asia/Almaty uses Kazakhstan UTC+5 and preserves explicitly chosen sending windows',()=>{
 const p=normalizeAutomationPolicy({timezone:'Asia/Almaty',mode:'manual',enabled:false,sendWindowStart:'09:00',sendWindowEnd:'16:30'});
 assert.equal(p.timezone,'Asia/Almaty');assert.equal(p.enabled,false);
 assert.equal(localClockParts(new Date('2026-10-26T04:00:00Z'),p.timezone).hour,9);
 assert.equal(isWithinSendWindow({...p,mode:'automatic',enabled:true},new Date('2026-10-26T03:59:00Z')),false);
 assert.equal(isWithinSendWindow({...p,mode:'automatic',enabled:true},new Date('2026-10-26T04:00:00Z')),true);
});
