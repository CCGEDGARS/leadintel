const test=require('node:test'),assert=require('node:assert/strict'),Adviser=require('../commercial-profile-adviser.js'),Brain=require('../company-brain.js'),Engine=require('../company-research-engine.js'),Readiness=require('../step2-readiness-engine.js'),Inference=require('../step2-first-party-intelligence.js');
const fixture=(name='Industrial Example',domain='industrial.example')=>({website:'https://'+domain+'/',uiLanguage:'en',targetMarkets:['Sweden'],answers:{priority_offers:'a full-spectrum service — from drawing development to on-site installation'},sources:[{id:'S1',type:'website',url:'https://'+domain+'/',text:name+' provides drawing development, custom metal manufacturing, steel fabrication and on-site installation. Our quality system references ISO 9001:2015.'},{id:'S2',type:'link',url:'https://'+domain+'/projects',text:'We manufacture steelwork for factories and construction projects. Workforce development and leadership training for our staff supports our production team.'}]});
test('all twelve areas receive coherent analytical help without passing hypotheses off as evidence',()=>{
 const advice=Adviser.buildAdvice(fixture(),Brain);assert.equal(advice.businessType,'industrial-services');
 assert.deepEqual(Object.keys(advice.fields),Adviser.FIELDS);assert.ok(Adviser.FIELDS.every(id=>advice.fields[id].value));
 assert.match(advice.fields.priority_offers.value,/Drawing development; Custom metal manufacturing; On-site installation/);
 assert.match(advice.fields.buyer_roles.value,/Engineering|Procurement/);assert.doesNotMatch(advice.fields.buyer_roles.value,/HR\/L&D|Sales\/Commercial Leadership/);
 assert.doesNotMatch(advice.fields.buying_outcomes.value,/sales methodology|sales and business processes/i);
 assert.match(advice.fields.ideal_customer.value,/Sweden/);assert.match(advice.fields.proof_points.value,/ISO 9001:2015/);
 for(const id of ['buyer_roles','exclusions','buying_triggers','value_proposition','objections','meeting_value']){assert.equal(advice.fields[id].draftType,'hypothesis');assert.deepEqual(advice.fields[id].sourceIds,[]);}
 assert.match(advice.fields.meeting_value.value,/scope|drawings/);assert.doesNotMatch(JSON.stringify(advice),/120 projects|30%|guaranteed savings/);
});
test('seller identity is not a routing rule and unrelated customer content is not company evidence',()=>{
 const original=fixture(),renamed=fixture('Another Company','another.example');
 const a=Adviser.buildAdvice(original,Brain),b=Adviser.buildAdvice(renamed,Brain);assert.deepEqual(a,b);
 const poisoned={...original,sources:[...original.sources,{id:'S3',url:'https://training-provider.example/',text:'Sales training; AI coaching; leadership development. ISO 99999.'}]};
 const next=Adviser.buildAdvice(poisoned,Brain);assert.deepEqual(next,a);assert.doesNotMatch(next.fields.proof_points.value,/99999/);
});
test('professional and software businesses receive their own buying groups and problems',()=>{
 for(const [offer,type,expected] of [['Sales training and business coaching','professional-services',/sponsor|functional leader/],['SaaS software application','software',/IT\/Technical/]]){
 const input={website:'https://seller.example',answers:{priority_offers:offer},sources:[{id:'S1',url:'https://seller.example',text:'We provide '+offer+' for B2B teams and help customers improve their business processes.'}]};const advice=Adviser.buildAdvice(input,Brain);assert.equal(advice.businessType,type);assert.match(advice.fields.buyer_roles.value,expected);assert.doesNotMatch(advice.fields.buying_outcomes.value,/drawing development|manufacturing and installation/);assert.equal(advice.fields.proof_points.value,'');
 }
 const selectedTraining={...fixture(),answers:{priority_offers:'Sales training for industrial project teams'}};assert.equal(Adviser.buildAdvice(selectedTraining,Brain).businessType,'professional-services');
});
test('unknown and unsupported facts remain unknown with actionable requests',()=>{
 const empty=Adviser.buildAdvice({website:'https://unknown.example',sources:[]},Brain);assert.ok(Object.values(empty.fields).every(row=>!row.value));
 const input=fixture();input.sources=input.sources.map(row=>({...row,text:row.text.replace('ISO 9001:2015','published quality requirements')}));const advice=Adviser.buildAdvice(input,Brain);assert.equal(advice.fields.proof_points.value,'');assert.match(advice.fields.proof_points.rationale,/certificate|reference/);
 assert.ok(Adviser.issuesFor('buyer_roles','CEO/Owner; Sales/Commercial Leadership; HR/L&D; Team Leadership',advice).length);
 assert.ok(Adviser.issuesFor('buying_outcomes','Sales and business processes can remain fragmented',advice).length);
 assert.ok(Adviser.issuesFor('exclusions','lovest price',advice).length);
});
test('runtime patch preserves all twelve fields and enforces citation authority on AI recommendations',()=>{
 const engine={...Engine};Readiness.patchResearchEngine(engine);Inference.patchResearchEngine(engine,{LeadIntelCompanyBrain:Brain});
 const draft=engine.buildEvidenceDraft(fixture());assert.ok(draft.delivery_approach.value);assert.ok(draft.meeting_value.value);
 const parsed=engine.parseAiDraft(JSON.stringify({fields:{buyer_roles:{value:'Engineering Director',confidence:'high',draft_type:'hypothesis',source_ids:['S1']},meeting_value:{value:'Review the scope and next step',confidence:'medium',draft_type:'hypothesis',source_ids:[]},proof_points:{value:'150 projects',confidence:'high',draft_type:'hypothesis',source_ids:[]},delivery_approach:{value:'Unknown certification process',confidence:'high',source_ids:['invented']}}}),['S1']);
 assert.equal(parsed.buyer_roles.draftType,'hypothesis');assert.equal(parsed.buyer_roles.confidence,'medium');assert.deepEqual(parsed.buyer_roles.sourceIds,[]);assert.ok(parsed.meeting_value);assert.equal(parsed.proof_points,undefined);assert.equal(parsed.delivery_approach,undefined);
 const merged=engine.mergeDraft({buyer_roles:'My edited buyer'},draft,{buyer_roles:{origin:'evidence_draft',draftValue:'Old draft',reviewed:false}});assert.equal(merged.answers.buyer_roles,'My edited buyer');assert.equal(merged.meta.buyer_roles.origin,'user');
});

test('a specific selected offer narrows priorities instead of expanding to every website capability',()=>{
 const input=fixture();input.answers.priority_offers='On-site installation';const advice=Adviser.buildAdvice(input,Brain);assert.equal(advice.fields.priority_offers.value,'On-site installation');assert.match(advice.fields.delivery_approach.value,/We provide on-site installation/);assert.doesNotMatch(advice.fields.delivery_approach.value,/We combine/);
});

test('the research engine keeps twelve fields even before the optional schema has loaded',()=>{
 const vm=require('node:vm'),fs=require('node:fs'),scope={};vm.runInNewContext(fs.readFileSync(require.resolve('../company-research-engine.js'),'utf8'),scope);const engine=scope.LeadIntelCompanyResearch;assert.equal(engine.QUESTION_IDS.length,12);const prompt=engine.buildAiPrompt({uiLanguage:'en'});assert.match(prompt.prompt,/delivery_approach/);assert.match(prompt.prompt,/meeting_value/);
});
