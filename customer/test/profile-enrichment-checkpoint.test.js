const test=require('node:test');
const assert=require('node:assert/strict');
const Checkpoint=require('../profile-enrichment-checkpoint.js');

test('shows both recommendations when neither enrichment activity is complete',()=>{
  assert.deepEqual(
    Checkpoint.pending({website:'https://example.com',researchMeta:{},referenceCustomers:{}}),
    ['company-research','lookalike-audience']
  );
});

test('accepts company research only when it belongs to the current website',()=>{
  assert.deepEqual(
    Checkpoint.pending({
      website:'https://example.com',
      researchMeta:{website:'https://old.example',generatedAt:'2026-09-21T08:00:00Z'},
      referenceCustomers:{activated:true,dna:{activeCount:3}}
    }),
    ['company-research']
  );
});

test('skips the checkpoint when research and lookalike DNA are ready',()=>{
  assert.deepEqual(
    Checkpoint.pending({
      website:'example.com',
      researchMeta:{website:'https://www.example.com/',generatedAt:'2026-09-21T08:00:00Z'},
      referenceCustomers:{activated:true,dna:{activeCount:3}}
    }),
    []
  );
});

test('lookalike analysis without activation remains an unfinished recommendation',()=>{
  assert.deepEqual(
    Checkpoint.pending({
      website:'example.com',
      researchMeta:{website:'example.com',generatedAt:'2026-09-21T08:00:00Z'},
      referenceCustomers:{activated:false,dna:{activeCount:3}}
    }),
    ['lookalike-audience']
  );
});
