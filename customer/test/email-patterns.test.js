import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../discovery-ui.js',import.meta.url),'utf8');
const start=source.indexOf('function emailPatternCandidates(');
const end=source.indexOf('function emailPatternPanel(',start);
const context={URL,canonicalDomain:value=>{try{return new URL(value).hostname;}catch{return String(value||'').toLowerCase();}}};
vm.runInNewContext(`${source.slice(start,end)};globalThis.patterns=emailPatternCandidates;globalThis.label=hunterStatusLabel;`,context);
const listingsStart=source.indexOf('function patternListings('),listingsEnd=source.indexOf('async function searchBuyerEmailPatterns(',listingsStart);
vm.runInNewContext(`${source.slice(listingsStart,listingsEnd)};globalThis.listings=patternListings;`,context);

test('full name produces ten distinct company patterns and ten Gmail patterns',()=>{
  const results=context.patterns({publicName:'Mārta Bērziņa'},'example.lv');
  assert.equal(results.length,20);
  assert.equal(results[0].email,'marta.berzina@example.lv');
  assert.ok(results.some(row=>row.email==='berzina.marta@example.lv'));
  assert.ok(results.some(row=>row.email==='marta.berzina@gmail.com'));
  assert.equal(results.filter(row=>row.type==='Gmail').length,10);
});

test('first name alone produces no guessed addresses and Gmail status never claims identity',()=>{
  assert.equal(context.patterns({name:'Lotta'},'example.com').length,0);
  assert.match(context.label({status:'webmail',deliverability:'inconclusive'},'lotta.test@gmail.com'),/person unconfirmed/);
  assert.match(context.label({status:'accept_all',deliverability:'inconclusive'},'lotta@example.com'),/inconclusive/);
});

test('automatic pattern search records exact public addresses with a source, including Gmail only near the full name',()=>{
  const person={publicName:'Marta Berzina'},domain='example.lv';
  const rows=[{url:'https://example.lv/team',markdown:'Marta Berzina can be reached at marta.berzina@example.lv'},
    {url:'https://association.test/members',description:'Marta Berzina · marta.berzina@gmail.com'},
    {url:'https://unrelated.test/directory',description:'Someone else · mberzina@gmail.com'}];
  const results=context.listings(person,domain,rows);
  assert.equal(results.length,2);
  assert.equal(results[0].url,'https://example.lv/team');
  assert.equal(results[1].email,'marta.berzina@gmail.com');
});
