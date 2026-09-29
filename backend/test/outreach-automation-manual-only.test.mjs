import test from 'node:test';
import assert from 'node:assert/strict';
import {automaticGmailDeliveryEnabled,automaticGmailDeliveryMode} from '../src/outreach-automation.js';

test('manual-only production switch disables automatic Gmail delivery',()=>{
  assert.equal(automaticGmailDeliveryMode({AUTOMATIC_GMAIL_DELIVERY_MODE:'manual_only'}),'manual_only');
  assert.equal(automaticGmailDeliveryEnabled({AUTOMATIC_GMAIL_DELIVERY_MODE:'manual_only'}),false);
});

test('automatic delivery requires an explicit enabled switch',()=>{
  assert.equal(automaticGmailDeliveryMode({}),'manual_only');
  assert.equal(automaticGmailDeliveryEnabled({}),false);
  assert.equal(automaticGmailDeliveryMode({AUTOMATIC_GMAIL_DELIVERY_MODE:'enabled'}),'enabled');
  assert.equal(automaticGmailDeliveryEnabled({AUTOMATIC_GMAIL_DELIVERY_MODE:'enabled'}),true);
});
