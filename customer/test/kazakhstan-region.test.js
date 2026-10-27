const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const P=require('../profile-engine.js'),D=require('../discovery-engine.js'),L=require('../content-language.js'),T=require('../message-translations.js'),O=require('../outreach-engine.js'),B=require('../brand-identity.js');
const profile={companyName:'Example Supplier',website:'https://supplier.example',priorityOffers:'industrial software',idealCustomer:'manufacturing companies',targetMarkets:'Kazakhstan',buyingTriggers:'new factory'};
const market={strategyApproved:true,icps:[{id:'core',type:'core',active:true,description:'manufacturing companies',targetMarkets:'Kazakhstan'}],signals:[{id:'expansion',name:'Facility expansion',keywords:'new factory',weight:8,active:true}]};
test('Kazakhstan preset toggles, deduplicates local spellings and survives save/reload',()=>{
 const w=new JSDOM(fs.readFileSync(require.resolve('../index.html'),'utf8')).window;
 try{
  const button=w.document.querySelector('[data-target-market="Kazakhstan"]');assert.ok(button);
  const state={targetMarkets:[]},stored=[];const ctx={state,window:w,CustomEvent:w.CustomEvent,document:w.document,LeadIntelProfile:P,$:id=>w.document.getElementById(id),esc:s=>s,invalidateStrategicOutputs(){},saveState(){stored.push(JSON.stringify(state));}};
  vm.createContext(ctx);const source=fs.readFileSync(require.resolve('../app.js'),'utf8');vm.runInContext(source.slice(source.indexOf('function renderTargetMarkets()'),source.indexOf('function addCustomTargetMarket()')),ctx);
  ctx.toggleTargetMarket('Kazakhstan');assert.equal(button.getAttribute('aria-pressed'),'true');assert.deepEqual(JSON.parse(stored.at(-1)).targetMarkets,['Kazakhstan']);
  assert.deepEqual(P.expandTargetMarkets(['Kazakhstan','KZ','ҚазақСТАН','Казахстан','Kazahstan','Kazahstāna']),['Kazakhstan']);
  ctx.toggleTargetMarket('Kazakhstan');assert.equal(button.getAttribute('aria-pressed'),'false');assert.deepEqual(JSON.parse(stored.at(-1)).targetMarkets,[]);
 }finally{w.close();}
});
test('discovery plans Kazakhstan with the KZ search location and all local country names',()=>{
 const queries=D.buildDiscoveryQueries(profile,market,8);assert.ok(queries.length);
 assert.ok(queries.every(q=>q.country==='KZ'));assert.ok(queries.some(q=>/Қазақстан/.test(q.query)&&/Казахстан/.test(q.query)));
 assert.equal(D.searchLocation('Қазақстан'),'Kazakhstan');
 const rows=[{company:'Local Factory',domain:'factory.kz',url:'https://factory.kz/',market:'Kazakhstan'},{company:'IDN Factory',domain:'factory.xn--80ao21a',url:'https://factory.xn--80ao21a/',market:'Kazakhstan'},{company:'Wrong Market',domain:'factory.se',url:'https://factory.se/',market:'Kazakhstan'}];
 const checks=D.buildCandidateVerificationQueries(rows,profile,market,6);assert.ok(checks.some(q=>q.domain==='factory.kz'));assert.ok(checks.some(q=>q.domain==='factory.xn--80ao21a'));assert.ok(checks.every(q=>q.domain!=='factory.se'));
});
test('source-backed Cyrillic companies remain distinct and unsupported names are rejected',()=>{
 const evidence=[{url:'https://news.example/kz',market:'Kazakhstan',title:'Алатау открывает новый завод',text:'Алатау и Өркен открывают новые предприятия в Казахстане.'}];
 const rows=['Алатау','Өркен','Выдуманная Компания'].map(company=>({company,sourceUrl:evidence[0].url}));
 assert.deepEqual(D.parseCompanyExtraction({companies:rows},evidence,10).map(r=>r.company),['Алатау','Өркен']);
 assert.notEqual(D.companyMentionKey('Алатау'),D.companyMentionKey('Өркен'));assert.equal(D.companyMentionKey('ТОО Алатау'),D.companyMentionKey('Алатау'));
 assert.ok(D.hasFullBuyerName('Әлихан Нұрланұлы'));
 const resolved=D.buildCompanyResolutionQueries(D.parseCompanyExtraction({companies:rows},evidence,10),profile,10);assert.equal(resolved.length,2);assert.equal(new Set(resolved.map(q=>q.id)).size,2);
 const fallback=D.extractCompanyMentions([{url:evidence[0].url,market:'Kazakhstan',text:'Алатау открывает новый завод. Өркен expands production.'}],10);assert.deepEqual(fallback.map(row=>row.company),['Алатау','Өркен']);
});
test('Cyrillic identity passes resolution and candidate assembly only with readable official legal identity',()=>{
 const url='https://alatau.kz/about',text='ТОО «Алатау» manufactures industrial equipment at its own factory in Kazakhstan. The company operates manufacturing facilities and production assembly for industrial customers.';
 const query={kind:'resolution',id:'resolve-alatau',company:'Алатау',market:'Kazakhstan'};
 const resolve=rows=>D.normalizeCompanySearchResults({results:rows},query);
 const official={url,title:'Алатау — официальный сайт',markdown:text,verifiedAt:new Date().toISOString()};
 const rows=resolve([official]);assert.equal(rows.length,1);assert.equal(rows[0].company,'Алатау');
 const attached=D.attachSourceEvidenceToResolvedCompanies(rows,[],[]);assert.equal(attached.length,1);
 const candidates=D.buildPotentialCompanyCandidates(attached,profile,market,[],10);assert.equal(candidates.length,1);assert.equal(candidates[0].domain,'alatau.kz');
 const saved=D.normalizeDiscoveryState(JSON.parse(JSON.stringify({potentialMatches:candidates}))).potentialMatches[0];
 for(const candidate of [candidates[0],saved]){
  assert.ok(!D.assessCompanyQualification(candidate,profile,market).gaps.some(gap=>/Verify company identity/.test(gap)),'official local identity must survive qualification and reload');
  assert.ok(D.assessCompanyQualification({...candidate,company:'Выдуманная Компания'},profile,market).gaps.some(gap=>/Verify company identity/.test(gap)));
 }
 const wrong={...rows[0],company:'Выдуманная Компания',title:'Посторонняя компания'};
 const scoped=D.buildPotentialCompanyCandidates([wrong,...attached],profile,market,[],10);assert.equal(scoped[0].company,'Алатау','an official identity is scoped to the exact company as well as its domain');
 assert.equal(resolve([{...official,markdown:'Алатау',description:text}]).length,0,'a snippet is not an official identity read');
 assert.equal(resolve([{...official,title:'Other company',markdown:text}]).length,0);
 assert.equal(resolve([{...official,url:'https://publisher.example/news/alatau'}]).length,0,'publisher articles cannot claim to be the company website');
 assert.equal(resolve([{...official,markdown:text.replace('Алатау','Басқа')}]).length,0,'a guessed transliteration is not identity evidence');
});
test('Kazakhstan automatic language inference requests confirmation; explicit choices are respected',()=>{
 for(const input of [{country:'Kazakhstan'},{country:'Қазақстан'},{domain:'https://factory.kz'},{domain:'https://factory.қаз'}]){
  const resolved=L.resolveCampaignLanguage(input);assert.equal(resolved.language,'ru');assert.equal(resolved.requiresConfirmation,true);
 }
 for(const language of ['kk','ru','en']){const resolved=L.resolveCampaignLanguage({country:'Kazakhstan',requested:language});assert.equal(resolved.language,language);assert.equal(resolved.requiresConfirmation,false);}
});
test('official company identity preserves Kazakh diacritics while matching legal names',()=>{
 const text='ТОО «Бәйтерек» manufactures industrial equipment in Kazakhstan. The company operates its own factory and production assembly facilities for local industrial customers.';
 const rows=D.normalizeCompanySearchResults({results:[{url:'https://baiterek.kz/about',title:'Бәйтерек — официальный сайт',markdown:text}]},{kind:'resolution',company:'Бәйтерек',market:'Kazakhstan'});
 assert.equal(rows.length,1);assert.equal(rows[0].company,'Бәйтерек');
});
test('translations preserve tenge amounts and cannot silently replace the currency',()=>{
 const source={subject:'Offer',message:'Budget: 250000 ₸'},good={subject:'Offer',message:'Бюджет: 250000 ₸'},bad={subject:'Offer',message:'Бюджет: 250000 ₽'};
 assert.doesNotThrow(()=>T.validate(source,good));assert.throws(()=>T.validate(source,bad),/numbers|facts|currency/i);
 const fields=['emailSubject','emailBody','linkedinMessage','callOpener','followUp','objectionReply'];const original=Object.fromEntries(fields.map(field=>[field,'Budget: 250000 ₸'])),changed={...original,emailBody:'Бюджет: 250000 ₽'};
 assert.throws(()=>L.validateCampaignPackage(original,changed),/currency|facts/i);
});
test('Kazakhstan buyer-country aliases do not create a false geographic mismatch',()=>{
 const person={name:'Әлихан Нұрланұлы',title:'Operations Director',country:'Қазақстан',organization:'Алатау',publicNameUrl:'https://alatau.kz/team'};
 const result=D.qualifyBuyer(person,{decisionMakers:'Operations Director'},{domain:'alatau.kz',company:'Алатау',market:'Kazakhstan'});
 assert.ok(!result.gaps.some(gap=>/country differs/i.test(gap)));
 const other=D.qualifyBuyer({...person,country:'Sweden'},{decisionMakers:'Operations Director'},{domain:'alatau.kz',company:'Алатау',market:'Kazakhstan'});
 assert.ok(other.gaps.some(gap=>/country differs/i.test(gap)));
 for(const country of ['UK','Scotland','Wales','England','United Kingdom']){
  const british=D.qualifyBuyer({...person,country},{decisionMakers:'Operations Director'},{domain:'buyer.co.uk',company:'Алатау',market:'United Kingdom'});assert.ok(!british.gaps.some(gap=>/country differs/i.test(gap)),country+' must remain equivalent to United Kingdom');
 }
});
for(const [language,body] of [['kk','Әлихан, сәлеметсіз бе!'],['ru','Здравствуйте, Әлихан!']])test(language+' messages preserve protected content and English through CRM reload',()=>{
 const item={domain:'factory.kz',channel:'email',selectedPersonId:'p1',drafts:{emailSubject:'Factory',emailBody:'Hi Әлихан!\n\nMeet for 20 minutes: https://example.com/meeting'},localizationProvenance:{language:'en'}};
 const draft={subject:'Factory',message:body+'\n\n20 минут: https://example.com/meeting'};
 assert.match(T.prompt(T.source(item),language,['Әлихан']).system,language==='kk'?/Kazakh/:/Russian/);
 const translated=T.translated(item,language,T.validate(T.source(item),draft,{protectedTerms:['Әлихан']}));
 const restored=O.restoreCrmScriptSnapshot(O.buildCrmScriptSnapshot(translated),item.domain);assert.equal(T.book(restored).versions[language].message,draft.message);assert.equal(T.activate(restored,'en').drafts.emailBody,item.drafts.emailBody);
 assert.equal(B.validate({phone:'+7 (7172) 92-55-52'}).errors.phone,undefined);
});
