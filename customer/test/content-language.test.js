const test=require('node:test');
const assert=require('node:assert/strict');
const language=require('../content-language.js');
test('auto language resolves from browser preference and explicit choice wins',()=>{
  assert.equal(language.resolveLanguage('auto',['lv-LV','en-US']),'lv');
  assert.equal(language.resolveLanguage('auto',['de-DE','en-US']),'en');
  assert.equal(language.resolveLanguage('en',['lv-LV']),'en');
  assert.equal(language.resolveLanguage('lv',['en-US']),'lv');
});
test('automatic campaign language uses the verified market and flags uncertain fallback',()=>{
  assert.deepEqual(language.resolveCampaignLanguage({requested:'auto',market:'Germany',domain:'buyer.de'}),{language:'de',source:'market',confidence:'high',requiresConfirmation:false});
  assert.deepEqual(language.resolveCampaignLanguage({requested:'auto',market:'Switzerland',domain:'buyer.ch'}),{language:'en',source:'fallback',confidence:'low',requiresConfirmation:true});
  assert.deepEqual(language.resolveCampaignLanguage({requested:'sv',market:'Germany',domain:'buyer.de'}),{language:'sv',source:'manual',confidence:'confirmed',requiresConfirmation:false});
});
test('campaign localization uses native sales rewriting and returns provider provenance',async()=>{
  let request;
  const source={tone:'consultative',emailSubject:'NordHaus — 15 minute discussion',emailBody:'Hello Anna,\n\nWould a 15 minute discussion help?\n\n[Your name]',linkedinMessage:'Hello Anna',callOpener:'Hello Anna',followUp:'Following up once.',objectionReply:'Understood.'};
  const localized={emailSubject:'NordHaus — 15-minütiges Gespräch',emailBody:'Guten Tag Anna,\n\nWäre ein 15-minütiges Gespräch hilfreich?\n\n[Your name]',linkedinMessage:'Guten Tag Anna',callOpener:'Guten Tag Anna',followUp:'Ich melde mich einmalig erneut.',objectionReply:'Verstanden.'};
  const root={fetch:async(url,options)=>{request={url,body:JSON.parse(options.body)};return new Response(JSON.stringify({provider:'anthropic',model:'claude-sonnet-4-6',text:JSON.stringify(localized)}),{status:200,headers:{'Content-Type':'application/json'}});}};
  const result=await language.localizeCampaignPackage(root,'workspace-1','de',source,{company:'NordHaus',market:'Germany',segment:'furniture retailers'});
  assert.match(request.body.system,/native German/i);
  assert.match(request.body.system,/sales email/i);
  assert.equal(result.drafts.emailBody,localized.emailBody);
  assert.equal(result.provider,'anthropic');
  assert.equal(result.model,'claude-sonnet-4-6');
});
test('campaign localization rejects changed numeric facts',async()=>{
  const source={tone:'consultative',emailSubject:'15 minute discussion',emailBody:'Would a 15 minute discussion help?',linkedinMessage:'Hello',callOpener:'Hello',followUp:'Following up.',objectionReply:'Understood.'};
  const bad={emailSubject:'30-minütiges Gespräch',emailBody:'Wäre ein 30-minütiges Gespräch hilfreich?',linkedinMessage:'Hallo',callOpener:'Hallo',followUp:'Nachfrage.',objectionReply:'Verstanden.'};
  const root={fetch:async()=>new Response(JSON.stringify({provider:'openai',model:'gpt-5.6',text:JSON.stringify(bad)}),{status:200,headers:{'Content-Type':'application/json'}})};
  await assert.rejects(()=>language.localizeCampaignPackage(root,'workspace-1','de',source,{}),/numeric facts/i);
});
test('campaign localization rejects changed protected names products geography and URLs',async()=>{
  const source={tone:'consultative',emailSubject:'Acme Model-X for Riga',emailBody:'Hello Anna, review https://acme.example/demo for Model-X in Riga.',linkedinMessage:'Hello Anna from Acme',callOpener:'Hello Anna',followUp:'Acme follow-up',objectionReply:'Model-X details.'};
  const bad={emailSubject:'Globex Model-Y für Berlin',emailBody:'Hallo Maria, siehe https://globex.example/demo für Model-Y in Berlin.',linkedinMessage:'Hallo Maria von Globex',callOpener:'Hallo Maria',followUp:'Globex Nachfrage',objectionReply:'Model-Y Details.'};
  const root={fetch:async()=>new Response(JSON.stringify({provider:'openai',model:'gpt-5.6',text:JSON.stringify(bad)}),{status:200,headers:{'Content-Type':'application/json'}})};
  await assert.rejects(()=>language.localizeCampaignPackage(root,'workspace-1','de',source,{protectedTerms:['Acme','Anna','Riga']}),/protected facts/i);
});
test('campaign localization allows ordinary segment offer and role phrases to be translated',()=>{
  const source={emailSubject:'Industrial automation',emailBody:'For furniture retailers and procurement managers in Germany.',linkedinMessage:'Industrial automation for furniture retailers.',callOpener:'Calling procurement managers.',followUp:'Following up about industrial automation.',objectionReply:'Understood.'};
  const localized={emailSubject:'Industrieautomatisierung',emailBody:'Für Möbelhändler und Einkaufsleiter in Deutschland.',linkedinMessage:'Industrieautomatisierung für Möbelhändler.',callOpener:'Anruf bei Einkaufsleitern.',followUp:'Nachfrage zur Industrieautomatisierung.',objectionReply:'Verstanden.'};
  assert.deepEqual(language.validateCampaignPackage(source,localized,{segment:'furniture retailers',offer:'industrial automation',buyerRole:'procurement managers',market:'Germany'}),localized);
});
test('campaign localization preserves compact alphanumeric product identifiers',()=>{
  const source={emailSubject:'RX500 proposal',emailBody:'Review RX500.',linkedinMessage:'RX500',callOpener:'RX500',followUp:'RX500',objectionReply:'RX500'};
  const changed={emailSubject:'PX500 Vorschlag',emailBody:'PX500 prüfen.',linkedinMessage:'PX500',callOpener:'PX500',followUp:'PX500',objectionReply:'PX500'};
  assert.throws(()=>language.validateCampaignPackage(source,changed,{}),/protected facts/i);
});
test('translation validates all fields and rejects missing or extra output',()=>{
  const source={f0:'Laboratory testing',f1:'24 months'};
  assert.throws(()=>language.validate(source,{f0:'Laboratorijas pārbaudes'}));
  assert.throws(()=>language.validate(source,{f0:'Laboratorijas pārbaudes',f1:'24 mēneši',x:'extra'}));
  assert.throws(()=>language.validate(source,{f0:'Laboratorijas pārbaudes',f1:'12 mēneši'}));
  assert.deepEqual(language.validate(source,{f0:'Laboratorijas pārbaudes',f1:'24 mēneši'}),{f0:'Laboratorijas pārbaudes',f1:'24 mēneši'});
});
test('translation accepts locale-only thousands separator changes but still rejects changed numeric facts',()=>{
  assert.deepEqual(
    language.validate({f0:'15,000+ sales visits'},{f0:'15 000+ pārdošanas vizīšu'},'lv'),
    {f0:'15 000+ pārdošanas vizīšu'}
  );
  assert.deepEqual(
    language.validate({f0:'Revenue €1,250,000 and 24 months'},{f0:'Ieņēmumi €1 250 000 un 24 mēneši'},'lv'),
    {f0:'Ieņēmumi €1 250 000 un 24 mēneši'}
  );
  assert.throws(()=>language.validate({f0:'15,000+ sales visits'},{f0:'15 500+ pārdošanas vizīšu'},'lv'),/numeric facts/);
  assert.throws(()=>language.validate({f0:'24 months'},{f0:'25 mēneši'},'lv'),/numeric facts/);
});
test('workspace and language isolate translation cache entries',()=>{
  assert.notEqual(language.cacheKey('one','lv',{f0:'Testing'}),language.cacheKey('two','lv',{f0:'Testing'}));
  assert.notEqual(language.cacheKey('one','en',{f0:'Testing'}),language.cacheKey('one','lv',{f0:'Testing'}));
});
test('translation prompt preserves facts and treats embedded instructions as data',()=>{
  const p=language.promptFor({f0:'Our approach is laboratory testing only'},'lv');
  assert.match(p.system,/Latvian/);
  assert.match(p.system,/Do not add/);
  assert.match(p.system,/untrusted data/);
  assert.match(p.prompt,/laboratory testing only/);
});
test('Latvian translation rejects obvious English prose left inside fields',()=>{
  assert.throws(()=>language.validate({f0:'We help companies improve sales'},{f0:'We help companies improve sales'},'lv'));
});
test('failed translations are retryable rather than cached as success',async()=>{
  let calls=0;
  const root={fetch:async()=>{calls++;return {ok: calls>1,status:calls>1?200:503,json:async()=>({text:JSON.stringify({f0:'Pārdošanas apmācības'})})};}};
  await assert.rejects(language.request(root,'retry-workspace','lv',{f0:'Sales training'}));
  const result=await language.request(root,'retry-workspace','lv',{f0:'Sales training'});
  assert.equal(result.f0,'Pārdošanas apmācības');assert.equal(calls,2);
});

test('translation starts independent field batches concurrently',async()=>{
  let calls=0;let release;
  const gate=new Promise(resolve=>{release=resolve;});
  const source=Object.fromEntries(Array.from({length:13},(_,index)=>[`f${index}`,`Source ${index}`]));
  const root={fetch:async(_url,options)=>{
    calls++;
    await gate;
    const prompt=JSON.parse(JSON.parse(options.body).prompt);
    return {ok:true,status:200,json:async()=>({text:JSON.stringify(Object.fromEntries(Object.keys(prompt).map(key=>[key,`Tulkojums ${key}`])))})};
  }};
  const pending=language.request(root,'parallel-workspace','lv',source);
  await new Promise(resolve=>setImmediate(resolve));
  const startedTogether=calls;
  release();
  const result=await pending;
  assert.equal(startedTogether,3);
  assert.equal(Object.keys(result).length,13);
});

test('market content translation updates generated fields and evidence display text without changing source identity',async()=>{
  const market={
    icps:[{id:'icp-core',name:'Core ICP',description:'Factories and warehouses',targetMarkets:'Latvia',buyerRoles:'Procurement managers',offers:'Office furniture',value:'',exclusions:'',rationale:'Generated rationale'}],
    signals:[{id:'growth',name:'Factory expansion',keywords:'new factory',reason:'Buying trigger',priority:'High'}],
    opportunities:[{id:'opp-latvia',market:'Latvia',title:'Latvia: Office furniture',hypothesis:'Prioritize factories',rationale:'Fit is based on evidence',evidence:[{url:'https://example.com/a',title:'Factory expansion',description:'A new warehouse is planned',text:'Original source text'}]}]
  };
  const translated={};for(const key of Object.keys(language.marketContentSource(market)))translated[key]=`lv:${key}`;
  const next=language.applyMarketContent(market,translated,'lv');
  assert.equal(next.icps[0].name,'lv:icp.0.name');
  assert.equal(next.signals[0].reason,'lv:signal.0.reason');
  assert.equal(next.opportunities[0].market,'Latvia');
  assert.equal(next.opportunities[0].marketLabel,'lv:opportunity.0.marketLabel');
  assert.equal(next.opportunities[0].evidence[0].displayTitle,'lv:opportunity.0.evidence.0.displayTitle');
  assert.equal(next.opportunities[0].evidence[0].text,'Original source text');
  assert.equal(next.contentLanguage,'lv');
});

test('language changes synchronize the live workspace state before it is saved',()=>{
  const workspace={uiLanguage:'en',profile:{companyName:'AJ Produkti'}};
  const result=language.applyLanguageSelection(workspace,'lv');
  assert.equal(result,workspace);
  assert.equal(workspace.uiLanguage,'lv');
  assert.equal(JSON.parse(JSON.stringify(workspace)).uiLanguage,'lv');
});


test('Latvian translation rejects broad English commercial prose, not only fixed phrases',()=>{
  assert.throws(
    ()=>language.validate(
      {f0:'Custom manufacturing and installation of metal structures and equipment'},
      {f0:'Custom manufacturing and installation of metal structures and equipment'},
      'lv'
    ),
    /English/i
  );
});
