(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.LeadIntelCommercialProfileAdviser=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const FIELDS=['priority_offers','ideal_customer','buyer_roles','exclusions','buying_outcomes','buying_triggers','value_proposition','differentiation','proof_points','objections','delivery_approach','meeting_value'];
 const HYPOTHESIS_FIELDS=new Set(['ideal_customer','buyer_roles','exclusions','buying_outcomes','buying_triggers','value_proposition','objections','meeting_value']);
 const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
 const host=value=>{try{return new URL(/^https?:\/\//i.test(value)?value:'https://'+value).hostname.replace(/^www\./,'').toLowerCase();}catch{return '';}};
 const unique=values=>[...new Set(values.filter(Boolean))];
 const label=id=>id.replaceAll('_',' ');
 function primarySources(input){const domain=host(input.website||'');return (input.sources||[]).filter(row=>clean(row.text)&&row.extracted!==false&&(!domain||host(row.url||'')===domain)).map((row,i)=>({...row,id:row.id||'S'+(i+1)}));}
 function hypothesis(value,rationale){return {value:clean(value),draftType:'hypothesis',confidence:'medium',sourceIds:[],rationale:rationale||'Commercial recommendation based on the selected offer and company evidence; review before accepting.'};}
 function evidence(value,rows,rationale){return {value:clean(value),draftType:'evidence',confidence:'medium',sourceIds:unique(rows.map(row=>row.id)),rationale};}
 function buildAdvice(input={},brain){
  const fields=Object.fromEntries(FIELDS.map(id=>[id,{value:'',confidence:'low',sourceIds:[],rationale:'Add company context to prepare a useful '+label(id)+' draft.'}]));
  if(String(input.uiLanguage||'en').toLowerCase().startsWith('lv'))return {fields,insights:[],businessType:'other'};
  const sources=primarySources(input),docs=(input.documents||[]).filter(row=>clean(row.text)).map((row,i)=>({...row,id:row.id||'D'+(i+1)}));
  if(!sources.length&&!docs.length)return {fields,insights:['No readable company evidence is available.'],businessType:'other'};
  const rows=[...sources,...docs],text=rows.map(row=>row.text).join('\n'),answers=input.answers||{};
  const classification=brain?.classifyCompany?.({profile:{priorityOffers:clean(answers.priority_offers)},scrapedSources:sources,documents:docs})||{};
  const type=classification.businessType==='other'&&/\bon[- ]site installation\b/i.test(clean(answers.priority_offers))&&/\b(?:drawing development|metal manufactur|steel fabricat)/i.test(text)?'industrial-services':classification.businessType||'other',markets=(input.targetMarkets||[]).map(clean).filter(Boolean),market=markets.length?' in '+markets.join(', '):'';
  const supports=pattern=>rows.filter(row=>pattern.test(row.text));
  const industrial=type==='industrial-services';
  const selectedOffer=clean(answers.priority_offers),specificOffer=!!selectedOffer&&!/full[-– ](?:spectrum|service)|from .* to /i.test(selectedOffer);
  const capabilities=industrial?[
   ['Drawing development',/\b(drawing development|engineering drawings?|technical drawings?|design development)\b/i],
   ['Custom metal manufacturing',/\b(custom metal|metal manufactur\w*|steel fabricat\w*|metal fabricat\w*|steelwork|welding|serial production)\b/i],
   ['On-site installation',/\b((?:on[- ]site |industrial )?installation|erection)\b/i]
  ].map(([name,pattern])=>({name,pattern,rows:supports(pattern)})).filter(row=>row.rows.length&&(!specificOffer||row.pattern.test(selectedOffer))):[];
  if(capabilities.length)fields.priority_offers=evidence(capabilities.map(row=>row.name).slice(0,3).join('; '),capabilities.flatMap(row=>row.rows),'Specific capabilities found in company evidence. Review which 1–3 should be commercial priorities.');
  else if(selectedOffer){const offerRows=rows.filter(row=>clean(row.text).toLowerCase().includes(selectedOffer.toLowerCase()));if(offerRows.length)fields.priority_offers=evidence(selectedOffer,offerRows,'Your selected offer is described in supplied company evidence.');else fields.priority_offers.rationale='Keep or refine your current offer; its exact scope still needs supporting company evidence.';}
  if(type==='professional-services'&&!fields.priority_offers.value){
   const offers=[['Sales training',/\bsales training\b/i],['Business coaching',/\b(?:business |sales )?coaching\b/i],['Leadership development',/\bleadership (?:development|training)\b/i],['AI consulting',/\b(?:AI (?:tools|consulting|integration|for business)|artificial intelligence)\b/i]].map(([name,pattern])=>({name,rows:supports(pattern)})).filter(row=>row.rows.length);
   if(offers.length)fields.priority_offers=evidence(offers.slice(0,3).map(row=>row.name).join('; '),offers.flatMap(row=>row.rows),'Service areas described in first-party evidence; confirm the current commercial priorities.');
  }
  const offer=clean(fields.priority_offers.value||answers.priority_offers);
  const models={
   'industrial-services':{
    customer:'Manufacturers, industrial asset owners, engineering/EPC contractors and project contractors'+market+' with an active fabrication, capacity, modernization or installation requirement; qualify technical scope, project timing and supplier requirements.',
    roles:'Project/Engineering Director — specifications and technical approval; Operations/Production Director — operational need and installation planning; Procurement/Purchasing Manager — supplier qualification and commercial terms; CEO/Managing Director — investment approval in smaller firms.',
    outcome:'Deliver a technically compliant project on schedule while reducing coordination gaps, rework and production disruption across drawing development, manufacturing and installation.',
    triggers:'Announced plant or production-line expansion; approved industrial modernization or equipment replacement; a new construction/EPC contract; an upcoming installation or shutdown window; a supplier-capacity gap. Qualify whether each event creates demand for the selected offer.',
    benefit:'Bring the relevant project stages together around one technical scope and delivery plan, helping the buyer coordinate fewer handovers, control avoidable rework and plan installation around operating constraints. Confirm project-specific timing, cost and risk benefits before promising them.',
    exclusions:'Proposed qualification rules: price-only purchasing that disregards technical compliance, quality or delivery reliability; work outside the confirmed technical scope; deadlines or certification requirements the company cannot meet. Confirm geography, capacity and minimum project value rather than inventing thresholds.',
    objections:'Likely concerns to validate: Can you meet the drawing tolerances and required standards? Is capacity available for our deadline? Who owns coordination and installation risk? How are transport, changes, site access and total project cost handled?',
    meeting:'Proposed first meeting: review the project scope, drawings, timing and installation constraints; identify missing specifications and agree the next technical/commercial step. Confirm which specialists and documents can be provided before promising a quote, assessment or production data.'
   },
   'professional-services':{
    customer:(/\bB2B\b/i.test(text)?'B2B organizations':'Organizations')+market+' with an active need for '+(offer||'the confirmed service')+' and a named sponsor, relevant team and willingness to implement changes; qualify the problem and buying process rather than assume headcount.',
    roles:'Business owner/CEO — economic sponsor; the functional leader responsible for the selected service — business need and implementation; HR/L&D — only when learning or people development is in scope; Procurement — when required by the buying process.',
    outcome:'Improve the business result addressed by '+(offer||'the selected service')+' by identifying the practical performance gap, aligning the responsible team and turning learning or advice into repeatable implementation.',
    triggers:'A new functional leader; team expansion; a documented performance gap; a new market or service launch; a transformation initiative related to the selected offer. Check the relevance of each event before treating it as buying intent.',
    benefit:'Connect '+(offer||'the service')+' to a specific business problem, a practical implementation plan and an observable success measure. Agree the baseline and responsibilities before promising an improvement.',
    exclusions:'Proposed: requests outside the confirmed offer; no accountable sponsor or willingness to implement; expectations of guaranteed results without participation. Confirm commercial minimums and delivery constraints with the company.',
    objections:'Likely concerns to validate: Will this apply to our situation? How will we measure progress? How much time must the team invest? What happens after the engagement? How does the total cost compare with the problem?',
    meeting:'Proposed first meeting: clarify the performance gap, affected team, desired result and current approach; identify the highest-priority improvement and agree a practical next step. Confirm what diagnostic material or examples are actually available.'
   },
   software:{
    customer:'Organizations'+market+' with a defined workflow or technology problem that '+(offer||'the software')+' can address; qualify current systems, integration requirements, users, security and budget ownership.',
    roles:'Functional process owner — business problem; IT/Technical leader — integration and security; Operations leader — adoption; economic buyer — budget approval; Procurement — contracting where applicable.',
    outcome:'Reduce friction in the target workflow, improve information quality and help users execute consistently. Validate the current baseline, system fit and measurable outcome.',
    triggers:'A system replacement or contract renewal; a new digital initiative; growing workflow volume; a new integration requirement; a documented operational or security gap.',
    benefit:'Connect the software capability to a specific workflow bottleneck and a feasible adoption/integration plan. Validate expected time or cost benefits rather than invent percentages.',
    exclusions:'Proposed: unsupported integrations or security requirements; no owner for implementation; use cases outside the product scope. Confirm delivery constraints before excluding prospects.',
    objections:'Likely concerns: integration effort; security and data handling; migration risk; adoption; total cost; support and vendor continuity.',
    meeting:'Proposed first meeting: map one relevant workflow, current systems, users and constraints; check product fit and agree whether a tailored demonstration or technical review is useful.'
   }
  };
  const supply={
   customer:'Business buyers'+market+' with a defined requirement for '+(offer||'the company’s products')+'; qualify application, specification, order cadence, volume, delivery location and supplier requirements.',
   roles:'Procurement/Purchasing — supplier selection; Engineering/Technical owner — specification and compliance; Operations/Production — application and continuity; economic buyer — budget approval.',
   outcome:'Obtain fit-for-purpose supply with dependable specifications, availability and delivery; reduce avoidable procurement friction and operational interruption.',
   triggers:'A new production or customer contract; a product launch; capacity expansion; a supplier change; replenishment or contract renewal related to the selected product.',
   benefit:'Match the confirmed product capabilities to the buyer’s specification, supply schedule and operating requirements. Assess total delivered cost and continuity without claiming unmeasured savings.',
   exclusions:'Proposed: incompatible specifications; unsupported delivery requirements; orders outside confirmed capacity or scope. Ask the company to confirm minimum order size, geography and commercial constraints.',
   objections:'Likely concerns: specification fit; product quality; availability; lead time; total delivered cost; warranty, support and supplier reliability.',
   meeting:'Proposed first meeting: review the application, specifications, volume, delivery schedule and current supply problem; identify a suitable product or the next qualification step.'
  };
  const model=models[type]||(['manufacturer','distributor'].includes(type)?supply:null);
  if(model){for(const [id,key] of Object.entries({ideal_customer:'customer',buyer_roles:'roles',buying_outcomes:'outcome',buying_triggers:'triggers',value_proposition:'benefit',exclusions:'exclusions',objections:'objections',meeting_value:'meeting'}))fields[id]=hypothesis(model[key]);}
  if(industrial&&capabilities.length){const combined=capabilities.map(row=>row.name.toLowerCase()).join(', ');const basis=capabilities.flatMap(row=>row.rows);fields.delivery_approach=evidence((capabilities.length>1?'We combine ':'We provide ')+combined+(capabilities.length>1?' through the same supplier.':'.')+' Confirm the project scope, technical requirements and responsibility for each stage.',basis,'Paraphrased from capabilities described on the company’s own pages.');fields.differentiation=evidence((capabilities.length>1?'A combined offering covering ':'An evidenced capability in ')+combined+'.',basis,'A supported capability combination, not a claim of superiority over competitors.');}
  const standardRows=supports(/\bISO\s*\d{4,5}\b/i),standards=unique(standardRows.flatMap(row=>row.text.match(/\bISO\s*\d{4,5}(?::\d{4})?(?:-\d)?\b/gi)||[]));
  if(standards.length)fields.proof_points=evidence('Published quality-standard references: '+standards.join('; ')+'. Confirm current certificate scope and validity before using certification claims.',standardRows,'These standard numbers occur in supplied company evidence; this does not independently verify accreditation or current validity.');
  else fields.proof_points={value:'',confidence:'low',sourceIds:[],rationale:'Add a verified certificate, named project/reference, or measured result with its source and permission. Do not invent client names, project counts or outcomes.'};
  const insights=industrial?['Sell reduced coordination and project risk, not a generic list of metal services.','Separate technical approval, operational ownership and procurement instead of targeting only senior titles.','Treat workforce services as a separate offer and buying group when that is the chosen commercial priority.']:model?['Connect the selected offer to a measurable buyer problem before broadening targeting.','Separate an observable event from evidence of actual buying intent.']:['The business model is not yet sufficiently evidenced; add a specific offer before inferring buyers or benefits.'];
  return {fields,insights,businessType:type};
 }
 function issuesFor(id,value,advice){
  const text=clean(value),issues=[];
  if(!text)issues.push('No draft is available yet.');
  if(advice?.businessType==='industrial-services'){
   if(id==='buyer_roles'&&/Sales\/Commercial Leadership|HR\/L&D|Team Leadership/i.test(text))issues.push('Generic professional-services roles conflict with the selected industrial offer. HR needs a separate workforce/people-services use case.');
   if(id==='buying_outcomes'&&/sales (?:skills|and business processes)|sales methodology|leadership system/i.test(text))issues.push('This outcome describes sales/training rather than the industrial buyer’s project or operating problem.');
   if(id==='priority_offers'&&/full[-– ]spectrum|full[- ]service/i.test(text))issues.push('Name the specific 1–3 capabilities the buyer can purchase.');
  }
  if(id==='buying_triggers'&&/^funding or investment[.!]?$/i.test(text))issues.push('Connect funding to a relevant project, equipment or capacity need; funding alone is not buying intent.');
  if(id==='differentiation'&&/^(custom solutions;\s*)?certified;\s*ISO certified$/i.test(text))issues.push('Replace repeated generic labels with supported capabilities and specific verified standards.');
  if(id==='exclusions'&&/^(?:lovest|lowest) price[.!]?$/i.test(text))issues.push('Clarify whether the exclusion means price-only purchasing, rather than any cost-conscious prospect.');
  return issues;
 }
 function mergeSuggestions(input={},advice,merge){return merge(input.answers||{},advice.fields||advice,input.fields||{});}
 return {FIELDS,HYPOTHESIS_FIELDS,primarySources,buildAdvice,issuesFor,mergeSuggestions};
});
