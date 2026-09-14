import test from 'node:test';
import assert from 'node:assert/strict';
import {automaticGmailDeliveryEnabled,automaticGmailDeliveryMode} from '../src/outreach-automation.js';

test('manual-only production switch disables automatic Gmail delivery',()=>{
  assert.equal(automaticGmailDeliveryMode({AUTOMATIC_GMAIL_DELIVERY_MODE:'manual_only'}),'manual_only');
  assert.equal(automaticGmailDeliveryEnabled({AUTOMATIC_GMAIL_DELIVERY_MODE:'manual_only'}),false);
});

test('automation remains testable when no production switch is configured',()=>{
  assert.equal(automaticGmailDeliveryMode({}),'enabled');
  assert.equal(automaticGmailDeliveryEnabled({}),true);
});
