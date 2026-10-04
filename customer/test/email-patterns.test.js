import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../discovery-ui.js',import.meta.url),'utf8');
const start=source.indexOf('function emailPatternCandidates(');
const end=source.indexOf('function contactFlowControls(',start);
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

test('format examples are not mistaken for a sourced buyer email',()=>{
  const result=context.listings({publicName:'Lotta Lyrå'},'sodra.com',[{url:'https://directory.test/sodra',description:'Södra Email Formats and Examples · lotta.lyra@sodra.com · Lotta Lyrå'}]);
  assert.equal(result.length,0);
});

test('focused grounded search can recover a name and address from a public association PDF',async()=>{
  const candidates=[];
  const focusedContext={...context,crmAuthenticated:()=>true,bridge:()=>({workspace:{id:'workspace-1'}}),LEADINTEL_API:'https://api.test',
    searchBuyerPublicPages:async query=>{candidates.push(query);return [];},
    fetch:async(_url,options)=>{const body=JSON.parse(options.body);assert.match(body.query,/"lotta.lyra@sodra.com" "Lotta Lyrå"/);return {ok:true,json:async()=>({results:[{url:'https://association.test/annual-report.pdf',description:'Lotta Lyrå · E-mail: lotta.lyra@sodra.com · Board member'}]})};}};
  focusedContext.fetchBuyerResearch=focusedContext.fetch;
  const searchStart=source.indexOf('async function searchBuyerEmailPatterns('),searchEnd=source.indexOf('async function groundedBuyerFollowUp(',searchStart);
  vm.runInNewContext(`${source.slice(searchStart,searchEnd)};globalThis.search=searchBuyerEmailPatterns;`,focusedContext);
  const candidate={domain:'sodra.com',people:[{publicName:'Lotta Lyrå'}]};
  const research=await focusedContext.search(candidate,[],new AbortController().signal);
  assert.equal(research.searches,5);
  assert.equal(research.failed,0);
  assert.equal(candidate.people[0].patternFindings[0].email,'lotta.lyra@sodra.com');
  assert.equal(candidate.people[0].patternFindings[0].url,'https://association.test/annual-report.pdf');
  assert.match(candidates[3],/lotta.lyra@sodra.com/);
});
test('Gmail discovery searches full name and company and accepts a sourced non-pattern address',async()=>{
 const queries=[];
 const ctx={...context,crmAuthenticated:()=>false,bridge:()=>null,searchBuyerPublicPages:async query=>{queries.push(query);return query.includes('"@gmail.com"')?[{url:'https://association.test/team',markdown:'Marta Berzina at Example: contact bluebird42@gmail.com'},{url:'https://association.test/other',markdown:'Other Person at Example: stranger@gmail.com'},{url:'https://club.test',markdown:'Marta Berzina supports Example. Club contact: clubteam@gmail.com'}]:[];}};
 const start=source.indexOf('async function searchBuyerEmailPatterns('),end=source.indexOf('async function groundedBuyerFollowUp(',start);
 vm.runInNewContext(`${source.slice(start,end)};globalThis.search=searchBuyerEmailPatterns;`,ctx);
 const candidate={company:'Example',domain:'example.lv',people:[{name:'Marta Berzina'}]};
 await ctx.search(candidate,[],new AbortController().signal);
 assert.ok(queries.some(query=>query==='"Marta Berzina" "Example" "@gmail.com"'));
 assert.deepEqual(Array.from(candidate.people[0].patternFindings,p=>p.email),['bluebird42@gmail.com']);
});
test('Gmail display uses Not found and never displays guessed Hunter addresses',()=>{
 const ctx={...context,LeadIntelDiscovery:{normalizeLinkedInUrl:()=>''},esc:value=>String(value)};
 const start=source.indexOf('function buyerContactRows('),end=source.indexOf('function emailPatternCandidates(',start);
 vm.runInNewContext(`${source.slice(start,end)};globalThis.render=buyerContactRows;`,ctx);
 const absent=ctx.render({hunterChecks:{'guess@gmail.com':{status:'invalid'}}},{domain:'example.lv'});
 assert.match(absent,/<strong>Gmail<\/strong><span>Not searched yet/);assert.doesNotMatch(absent,/guess@gmail/);
 const found=ctx.render({patternFindings:[{email:'bluebird42@gmail.com',url:'https://association.test'}]},{domain:'example.lv'});
 assert.match(found,/<strong>Gmail<\/strong><span><span class="buyer-email-result">bluebird42@gmail.com<\/span>/);
});
