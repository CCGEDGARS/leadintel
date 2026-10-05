import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const D=createRequire(import.meta.url)('../discovery-engine.js');

const source=fs.readFileSync(new URL('../discovery-ui.js',import.meta.url),'utf8');
const start=source.indexOf('function emailPatternCandidates(');
const end=source.indexOf('function contactFlowControls(',start);
const context={LeadIntelDiscovery:D,URL,canonicalDomain:value=>{try{return new URL(value).hostname;}catch{return String(value||'').toLowerCase();}}};
vm.runInNewContext(`${source.slice(start,end)};globalThis.patterns=emailPatternCandidates;globalThis.label=hunterStatusLabel;`,context);
const listingsStart=source.indexOf('function patternListings('),listingsEnd=source.indexOf('async function searchBuyerEmailPatterns(',listingsStart);
vm.runInNewContext(`${source.slice(listingsStart,listingsEnd)};globalThis.listings=patternListings;`,context);

test('full name produces bounded company-only guesses with no Gmail or first-name-only guesses',()=>{
  const results=context.patterns({publicName:'Mārta Bērziņa'},'example.lv');
  assert.equal(results.length,8);assert.equal(results[0].email,'marta.berzina@example.lv');
  assert.ok(results.every(row=>row.type==='Company'&&row.status==='guessed'));
  assert.ok(!results.some(row=>row.email==='marta@example.lv'));
});

test('first name alone produces no guessed addresses and Gmail status never claims identity',()=>{
  assert.equal(context.patterns({name:'Lotta'},'example.com').length,0);
  assert.match(context.label({status:'webmail',deliverability:'inconclusive'},'lotta.test@gmail.com'),/person unconfirmed/);
  assert.match(context.label({status:'accept_all',deliverability:'inconclusive'},'lotta@example.com'),/inconclusive/);
});

test('automatic pattern search records exact public addresses with a source, including Gmail only near the full name',()=>{
  const person={publicName:'Marta Berzina'},domain='example.lv';
  const rows=[{url:'https://example.lv/team',markdown:'Marta Berzina can be reached at marta.berzina@example.lv'},
    {url:'https://association.test/members',description:'Marta Berzina at Example: marta.berzina@gmail.com'},
    {url:'https://unrelated.test/directory',description:'Someone else · mberzina@gmail.com'}];
  const results=context.listings(person,domain,rows,'Example');
  assert.equal(results.length,2);
  assert.equal(results[0].url,'https://example.lv/team');
  assert.equal(results[1].email,'marta.berzina@gmail.com');
});

test('format examples are not mistaken for a sourced buyer email',()=>{
  const result=context.listings({publicName:'Lotta Lyrå'},'sodra.com',[{url:'https://directory.test/sodra',description:'Södra Email Formats and Examples · lotta.lyra@sodra.com · Lotta Lyrå'}]);
  assert.equal(result.length,0);
});

test('published middle-initial address before a labelled contact name is preserved exactly',()=>{
 const rows=[{url:'https://association.test/member',markdown:'Bransch: Industry\nWebb: example.com\nE-post: mats.o.stalnacke@example.com\nKontakt: Mats Stålnacke'}];
 const findings=D.sourcedBuyerEmails({name:'Mats Stålnacke'},'example.com',rows,'Example');
 assert.deepEqual(findings.map(row=>row.email),['mats.o.stalnacke@example.com']);
 assert.equal(D.sourcedBuyerEmails({name:'Anna Smith'},'example.com',rows,'Example').length,0);
});
test('model-written contact summaries cannot turn guessed addresses into public listings',()=>{
 const person={name:'Anna Smith'};
 const row={url:'https://example.com/team',title:'Team',description:'Anna Smith anna.smith@example.com',evidenceKind:'model_summary'};
 assert.equal(D.sourcedBuyerEmails(person,'example.com',[row]).length,0);
 assert.equal(D.sourcedBuyerEmails(person,'example.com',[{...row,markdown:'Anna Smith: a.smith@example.com'}])[0].email,'a.smith@example.com');
});
test('rechecking source text replaces a wrong saved address and retains the exact rejection',async()=>{
 const ctx={...context,fetchFirecrawlBuyerResearch:async()=>({ok:true,json:async()=>({data:{markdown:'E-post: mats.o.stalnacke@example.com\nKontakt: Mats Stålnacke'}})})};
 const start=source.indexOf('async function recheckBuyerEmailSources('),end=source.indexOf('async function searchBuyerEmailPatterns(',start);
 vm.runInNewContext(source.slice(start,end)+';globalThis.recheck=recheckBuyerEmailSources;',ctx);
 const url='https://association.test/member',person={name:'Mats Stålnacke',publicEmail:'mats.stalnacke@example.com',publicEmailUrl:url,patternFindings:[{email:'mats.stalnacke@example.com',url}]};
 const checks=await ctx.recheck(person,{company:'Example',domain:'example.com'},new AbortController().signal);
 assert.equal(person.publicEmail,'mats.o.stalnacke@example.com');
 assert.deepEqual(Array.from(person.patternFindings,row=>row.email),['mats.o.stalnacke@example.com']);
 assert.deepEqual(Array.from(checks[0].rejected),['mats.stalnacke@example.com']);
 const normalized=D.normalizeDiscoveryState({selectedProspects:[{company:'Example',domain:'example.com',buyerSearchMode:'user_selected_target',people:[{...person,emailResearch:{status:'complete',sourceRechecks:checks}}]}]});
 assert.equal(normalized.selectedProspects[0].people[0].emailResearch.sourceRechecks[0].rejected[0],'mats.stalnacke@example.com');
});
test('source failures preserve evidence and are reported as unavailable, never a negative finding',async()=>{
 const ctx={...context,fetchFirecrawlBuyerResearch:async()=>({ok:false})};
 const start=source.indexOf('async function recheckBuyerEmailSources('),end=source.indexOf('async function searchBuyerEmailPatterns(',start);
 vm.runInNewContext(source.slice(start,end)+';globalThis.recheck=recheckBuyerEmailSources;',ctx);
 const person={name:'Anna Smith',patternFindings:[{email:'anna.smith@example.com',url:'https://example.com/team'}]};
 const checks=await ctx.recheck(person,{company:'Example',domain:'example.com'},new AbortController().signal);
 assert.equal(checks[0].status,'unavailable');assert.equal(person.patternFindings.length,1);assert.equal(checks[0].rejected.length,0);
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
  assert.equal(research.searches,7);
  assert.equal(research.failed,0);
  assert.equal(candidate.people[0].patternFindings[0].email,'lotta.lyra@sodra.com');
  assert.equal(candidate.people[0].patternFindings[0].url,'https://association.test/annual-report.pdf');
  assert.match(candidates[5],/lotta.lyra@sodra.com/);
});
test('Gmail discovery searches full name and company and accepts a sourced non-pattern address',async()=>{
 const queries=[];
 const ctx={...context,crmAuthenticated:()=>false,bridge:()=>null,searchBuyerPublicPages:async query=>{queries.push(query);return query.includes('"@gmail.com"')?[{url:'https://association.test/team',markdown:'Marta Berzina at Example: contact bluebird42@gmail.com'},{url:'https://association.test/other',markdown:'Other Person at Example: stranger@gmail.com'},{url:'https://club.test',markdown:'Marta Berzina supports Example. Club contact: clubteam@gmail.com'}]:[];}};
 const start=source.indexOf('async function searchBuyerEmailPatterns('),end=source.indexOf('async function groundedBuyerFollowUp(',start);
 vm.runInNewContext(`${source.slice(start,end)};globalThis.search=searchBuyerEmailPatterns;`,ctx);
 const candidate={company:'Example',domain:'example.lv',people:[{name:'Marta Berzina'}]};
 await ctx.search(candidate,[],new AbortController().signal);
 assert.ok(queries.some(query=>query.startsWith('"Marta Berzina" "Example" ("@gmail.com" OR')));
 assert.deepEqual(Array.from(candidate.people[0].patternFindings,p=>p.email),['bluebird42@gmail.com']);
});
test('Gmail display uses Not found and never displays guessed Hunter addresses',()=>{
 const ctx={...context,LeadIntelDiscovery:{normalizeLinkedInUrl:()=>''},esc:value=>String(value)};
 const start=source.indexOf('function buyerContactRows('),end=source.indexOf('function emailPatternCandidates(',start);
 vm.runInNewContext(`${source.slice(start,end)};globalThis.render=buyerContactRows;`,ctx);
 const absent=ctx.render({hunterChecks:{'guess@gmail.com':{status:'invalid'}}},{domain:'example.lv'});
 assert.match(absent,/<strong>Gmail<\/strong><span>Not searched yet/);assert.doesNotMatch(absent,/guess@gmail/);
 const found=ctx.render({patternFindings:[{email:'bluebird42@gmail.com',url:'https://association.test'}]},{domain:'example.lv'});
 assert.match(found,/<strong>Gmail<\/strong><span><span class="buyer-email-result">bluebird42@gmail.com · Publicly listed · unverified/);
});
test('person-first official research recovers a published email and phone even when guesses return nothing',async()=>{
 const queries=[],ctx={...context,crmAuthenticated:()=>false,searchBuyerPublicPages:async query=>{queries.push(query);return query==='site:example.lv "Marta Berzina"'?[{url:'https://example.lv/jobs/engineering',markdown:'Contact manager Marta Berzina, marta.berzina@example.lv, +371 2000 1234.'}]:[];}};
 const start=source.indexOf('async function searchBuyerEmailPatterns('),end=source.indexOf('async function groundedBuyerFollowUp(',start);
 vm.runInNewContext(`${source.slice(start,end)};globalThis.search=searchBuyerEmailPatterns;`,ctx);
 const candidate={company:'Example',domain:'example.lv',people:[{name:'Marta Berzina',title:'Engineering Manager'}]};
 await ctx.search(candidate,[],new AbortController().signal);
 assert.equal(queries[0],'site:example.lv "Marta Berzina"');
 assert.equal(candidate.people[0].publicEmail,'marta.berzina@example.lv');assert.equal(candidate.people[0].publicPhone,'+371 2000 1234');
 assert.equal(candidate.people[0].publicPhoneUrl,'https://example.lv/jobs/engineering');assert.equal(candidate.people[0].emailResearch.status,'complete');
});
test('phone attribution stops at another contact section and clears a rechecked wrong number',()=>{
 const person={name:'Robert Buyer',title:'Head of Procurement',publicPhone:'0980-725 08',publicPhoneUrl:'https://example.com/jobs'};
 const rows=[{url:'https://example.com/jobs',markdown:'Contact Head of Procurement Robert Buyer, robert.buyer@example.com\n\nFackliga kontakter:\nSakari Other, Unionen 0980-725 08'}];
 const result=D.matchPublicBuyerDetails([person],rows,'example.com')[0];assert.equal(result.publicEmail,'robert.buyer@example.com');assert.equal(result.publicPhone,'');assert.equal(result.publicPhoneUrl,'');
 const direct=D.matchPublicBuyerDetails([person],[{url:'https://example.com/jobs',markdown:'Contact Robert Buyer, robert.buyer@example.com, +46 920 38029.\n\nOther Person +46 980 72508'}],'example.com')[0];assert.equal(direct.publicPhone,'+46 920 38029');
});
test('individual request timeout is recorded without stopping another buyer or later search stages',async()=>{
 const queries=[],ctx={...context,crmAuthenticated:()=>false,searchBuyerPublicPages:async query=>{queries.push(query);if(query==='site:example.lv "Marta Berzina"')throw Object.assign(new Error('request timed out'),{name:'AbortError',code:'BUYER_REQUEST_TIMEOUT'});return query==='site:example.lv "Anna Lind"'?[{url:'https://example.lv/team',markdown:'Anna Lind anna.lind@example.lv +371 2000 1234'}]:[];}};
 const start=source.indexOf('async function searchBuyerEmailPatterns('),end=source.indexOf('async function groundedBuyerFollowUp(',start);vm.runInNewContext(`${source.slice(start,end)};globalThis.search=searchBuyerEmailPatterns;`,ctx);
 const candidate={company:'Example',domain:'example.lv',people:[{name:'Marta Berzina'},{name:'Anna Lind'}]};await ctx.search(candidate,[],new AbortController().signal);
 assert.equal(candidate.people[0].emailResearch.status,'partial');assert.equal(candidate.people[0].emailResearch.failed,1);assert.equal(candidate.people[1].publicEmail,'anna.lind@example.lv');assert.ok(queries.some(q=>q.includes('"Marta Berzina" "Example"')));
});
test('a failed phone query does not mark completed Gmail incomplete, and retry executes only unfinished checks',async()=>{
 let fail=true;const queries=[],ctx={...context,crmAuthenticated:()=>false,searchBuyerPublicPages:async query=>{queries.push(query);if(query.includes('(phone OR')){if(fail)throw new Error('Phone source timed out');return [];}return [];}};
 const start=source.indexOf('async function searchBuyerEmailPatterns('),end=source.indexOf('async function groundedBuyerFollowUp(',start);vm.runInNewContext(source.slice(start,end)+';globalThis.search=searchBuyerEmailPatterns;',ctx);
 const candidate={company:'Example',domain:'example.lv',people:[{name:'Marta Berzina',title:'Head of Procurement'}]};
 await ctx.search(candidate,[],new AbortController().signal);
 assert.equal(candidate.people[0].contactResearch.channels.gmail.status,'complete');
 assert.equal(candidate.people[0].contactResearch.channels.phone.status,'partial');
 const before=queries.length;fail=false;await ctx.search(candidate,[],new AbortController().signal);
 assert.equal(queries.length-before,1);assert.ok(queries.at(-1).includes('(phone OR'));
 assert.equal(candidate.people[0].contactResearch.channels.phone.status,'complete');
});
