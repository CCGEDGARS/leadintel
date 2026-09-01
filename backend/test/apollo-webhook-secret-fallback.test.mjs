import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as ApolloWebhook from '../src/apollo-crm-webhook.js';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const crmRoutes=fs.readFileSync(path.join(__dirname,'..','src','crm-routes.js'),'utf8');
const webhookSource=fs.readFileSync(path.join(__dirname,'..','src','apollo-crm-webhook.js'),'utf8');

test('Apollo webhook signing uses a dedicated secret when present and safely falls back to the protected Apollo API key',()=>{
  assert.equal(typeof ApolloWebhook.apolloWebhookSigningSecret,'function');
  if(typeof ApolloWebhook.apolloWebhookSigningSecret!=='function')return;
  assert.equal(ApolloWebhook.apolloWebhookSigningSecret({APOLLO_WEBHOOK_SECRET:'dedicated-secret',APOLLO_API_KEY:'api-key'}),'dedicated-secret');
  assert.equal(ApolloWebhook.apolloWebhookSigningSecret({APOLLO_API_KEY:'api-key'}),'api-key');
  assert.equal(ApolloWebhook.apolloWebhookSigningSecret({}),'');
  assert.match(crmRoutes,/apolloWebhookSigningSecret\(env\)/);
  assert.match(webhookSource,/apolloWebhookSigningSecret\(env\)/);
});
