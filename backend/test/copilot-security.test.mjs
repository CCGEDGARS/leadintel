import test from 'node:test';
import assert from 'node:assert/strict';
import {
  containsProtectedKeyName,
  redactProtectedData,
  sanitizeClientScreenContext,
  sanitizeExternalResearchQuery,
  assertModelSafe
} from '../src/copilot-security.js';

const PROTECTED_KEYS=[
  'api_key','apikey','encrypted_api_key','access_token','refresh_token','password','secret',
  'client_secret','cookie','authorization','private_key','database_url','connection_string'
];

test('protected credential and infrastructure key names are detected case-insensitively',()=>{
  for(const key of PROTECTED_KEYS){
    assert.equal(containsProtectedKeyName(key),true,key);
    assert.equal(containsProtectedKeyName(key.toUpperCase()),true,key.toUpperCase());
  }
  for(const safe of ['provider','status','verified_at','last_used_at','pipeline_stage','keynote'])assert.equal(containsProtectedKeyName(safe),false,safe);
});

test('recursive redaction removes protected keys and sentinel secret values at every depth',()=>{
  const sentinels=['SECRET-API-123','REFRESH-TOKEN-XYZ','COOKIE-ABC','DB-CONNECTION-PRIVATE'];
  const input={
    company:{name:'Safe Co',api_key:sentinels[0],nested:{refresh_token:sentinels[1]}},
    integrations:[{provider:'apollo',status:'connected',cookie:sentinels[2]}],
    notes:{connection_string:sentinels[3],safe:'keep me'}
  };
  const serialized=JSON.stringify(redactProtectedData(input));
  for(const sentinel of sentinels)assert.equal(serialized.includes(sentinel),false,sentinel);
  assert.match(serialized,/Safe Co/);assert.match(serialized,/keep me/);assert.match(serialized,/apollo/);
});

test('recursive redaction also removes credential-like values hidden inside benign text fields',()=>{
  const input={
    notes:'Call the buyer. sk-proj-abcdefghijklmnopqrstuvwxyz0123456789 and Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.super-long-token.signature must never reach the model.',
    description:'password=hunter2 api_key=apollo-secret-value keep commercial context'
  };
  const serialized=JSON.stringify(redactProtectedData(input));
  assert.doesNotMatch(serialized,/sk-proj-|Bearer\s+|hunter2|apollo-secret-value/i);
  assert.match(serialized,/Call the buyer/);assert.match(serialized,/keep commercial context/);
});

test('screen context accepts only bounded navigation metadata and cannot smuggle workspace state',()=>{
  const result=sanitizeClientScreenContext({
    step:4,label:'Market Strategy',entityType:'company',entityId:'crm-123',
    workspace:{id:'other-workspace',api_key:'do-not-send'},payload:{private:'state'},html:'<body>secret</body>'
  });
  assert.deepEqual(Object.keys(result).sort(),['entityId','entityType','label','step']);
  assert.equal(result.step,4);assert.equal(result.label,'Market Strategy');assert.equal(result.entityId,'crm-123');
  assert.ok(JSON.stringify(result).length<1200);
});

test('external research query strips bearer tokens, provider keys, opaque credentials and email addresses',()=>{
  const input='Check Apollo pricing for buyer@example.com Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.super-long-token.signature sk-proj-abcdefghijklmnopqrstuvwxyz0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const result=sanitizeExternalResearchQuery(input);
  assert.doesNotMatch(result,/buyer@example\.com/i);
  assert.doesNotMatch(result,/Bearer\s+/i);
  assert.doesNotMatch(result,/sk-proj-/i);
  assert.doesNotMatch(result,/ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/);
  assert.match(result,/Apollo pricing/i);
  assert.ok(result.length<=1000);
});

test('model safety assertion rejects nested protected data and accepts sanitized context',()=>{
  assert.throws(()=>assertModelSafe({provider:'openai',nested:{client_secret:'sentinel'}}),/protected|unsafe|secret/i);
  assert.doesNotThrow(()=>assertModelSafe({provider:'openai',status:'connected',screen:{step:2,label:'Strategic Intake'}}));
});
