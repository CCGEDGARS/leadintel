const STORAGE_KEY='leadintel_customer_v2_state';
const RESEARCH_META_KEY='leadintel_customer_v2_research_meta_v1';
const CANONICAL_MIGRATION_KEY='leadintel_canonical_profile_v1_migrated';

(function installCanonicalRuntime(root){
  const Profile=root.LeadIntelProfile,Canonical=root.LeadIntelCanonicalIntelligence,Brain=root.LeadIntelCompanyBrain,Refs=root.LeadIntelReferenceCustomers;
  if(!Profile||!Canonical||Profile.__canonicalRuntimeInstalled)return;
  const originalBuild=Profile.buildCompanyIntelligenceProfile.bind(Profile);
  const originalNormalize=Profile.normalizeSavedState.bind(Profile);
  const labelFor=field=>({priorityOffers:'Priority Offer',idealCustomer:'Ideal Customer / ICP',targetMarkets:'Target Market',customerPainPoints:'Customer Problems',buyingTriggers:'Buying Triggers',decisionMakers:'Decision Makers',differentiation:'Differentiation',commercialObjective:'Commercial Objective'}[field]||field);

  function readResearchMeta(input={}){
    if(input.researchMeta&&typeof input.researchMeta==='object')return input.researchMeta;
    if(typeof localStorage==='undefined')return {};
    try{const meta=JSON.parse(localStorage.getItem(RESEARCH_META_KEY)||'{}');const website=String(input.website||'').replace(/\/$/,'');const metaWebsite=String(meta.website||'').replace(/\/$/,'');return website&&metaWebsite&&website===metaWebsite?meta:{};}catch{return {};}
  }
  function derive(input,base){
    const brain=Brain?.deriveCanonicalContext?.(input,input.uiLanguage)||null;
    return {
      ...(brain||{}),
      customerPainPoints:brain?.customerPainPoints||base?.customerPainPoints||'',
      customerPainPointsConfidence:base?.customerPainPointsStatus&&/confirm/i.test(base.customerPainPointsStatus)?'high':'medium',
      recommendedSignals:brain?.recommendedSignals||base?.recommendedSignals||[],
      interpretation:brain?.interpretation||base?.analysis?.interpretation||{},
      websiteFields:{
        priorityOffers:base?.priorityOffers||'',idealCustomer:base?.idealCustomer||'',buyingTriggers:base?.buyingTriggers||'',
        decisionMakers:base?.decisionMakers||'',differentiation:base?.differentiation||'',commercialObjective:base?.commercialObjective||'',
        exclusions:base?.exclusions||'',opportunityValue:base?.opportunityValue||'',marketFocus:base?.marketFocus||''
      }
    };
  }
  function gapsFromDiagnostics(diagnostics=[]){return diagnostics.filter(row=>row.state!=='known').map(row=>row.state==='needs_confirmation'?`${labelFor(row.field)} is inferred and needs confirmation.`:`${labelFor(row.field)} is missing.`);}
  function applyCanonical(base,input){
    const enrichedInput={...input,researchMeta:readResearchMeta(input)};const derived=derive(enrichedInput,base);
    const canonical=Canonical.normalizeCanonicalProfile(base,{...enrichedInput,baseProfile:base},derived);
    const merged={...base,...canonical,website:base.website||input.website||'',recommendedSignals:derived.recommendedSignals||base.recommendedSignals||[],interpretation:derived.interpretation||base.interpretation||{}};
    merged.externalValidationSources=[];
    merged.informationGaps=gapsFromDiagnostics(merged.canonical?.diagnostics||[]);
    return merged;
  }
  function patchedBuild(input={}){return applyCanonical(originalBuild(input),input);}
  function preserveConfirmedFields(current,rebuilt){
    const fields=current?.canonical?.fields||{};
    for(const [key,record] of Object.entries(fields)){
      if(record?.status!=='user_confirmed'||!String(record.value||'').trim())continue;
      rebuilt.canonical.fields[key]={...record,updatedAt:record.updatedAt||new Date().toISOString()};rebuilt[key]=record.value;
    }
    rebuilt.canonical.diagnostics=Canonical.diagnoseCanonicalProfile(rebuilt);rebuilt.informationGaps=gapsFromDiagnostics(rebuilt.canonical.diagnostics);return rebuilt;
  }
  function patchedNormalize(value={}){
    const normalized=originalNormalize(value);normalized.answerStatus=value.answerStatus&&typeof value.answerStatus==='object'?{...value.answerStatus}:{};
    if(Refs){let referenceState=value.referenceCustomers||{};if(!referenceState.rows?.length&&value.answers?.lookalike_customers){referenceState={rows:Refs.migrateLegacyLookalikes(value.answers.lookalike_customers)};}normalized.referenceCustomers=Refs.normalizeReferenceState(referenceState);}
    if(normalized.profile&&normalized.website){const rebuilt=patchedBuild({...normalized,answerStatus:normalized.answerStatus,researchMeta:readResearchMeta(normalized)});normalized.profile=preserveConfirmedFields(value.profile,{...normalized.profile,...rebuilt});}
    return normalized;
  }
  Profile.buildCompanyIntelligenceProfile=patchedBuild;Profile.normalizeSavedState=patchedNormalize;Profile.__canonicalRuntimeInstalled=true;

  function readState(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');}catch{return {};}}
  function writeState(state){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
  function migrateCurrentWorkspace(){
    if(typeof localStorage==='undefined')return false;const raw=readState();if(!raw.website)return false;
    const needsProfileMigration=raw.profile&&Number(raw.profile?.canonical?.version)!==Canonical.VERSION;const needsReferenceMigration=Refs&&raw.answers?.lookalike_customers&&!raw.referenceCustomers?.rows?.length;
    if(!needsProfileMigration&&!needsReferenceMigration)return false;
    const normalized=patchedNormalize({...raw,researchMeta:readResearchMeta(raw)});
    const merged={...raw,profile:normalized.profile,referenceCustomers:normalized.referenceCustomers||raw.referenceCustomers,answerStatus:normalized.answerStatus||raw.answerStatus,scrapedSources:normalized.scrapedSources||raw.scrapedSources,documents:normalized.documents||raw.documents,targetMarkets:normalized.targetMarkets||raw.targetMarkets,additionalLinks:normalized.additionalLinks||raw.additionalLinks};writeState(merged);return true;
  }
  function promoteEdits(){
    const state=readState();if(!state.profile?.canonical?.fields)return;let changed=false;
    for(const field of Canonical.DIAGNOSTIC_FIELDS){const value=Array.isArray(state.profile[field])?state.profile[field].join('; '):String(state.profile[field]||'').trim();const record=state.profile.canonical.fields[field]||{};if(value&&value!==String(record.value||'').trim()){state.profile.canonical.fields[field]=Canonical.fieldRecord(value,{status:'user_confirmed',provenance:'user',sourceIds:[`U:${field}`],confidence:'high'});changed=true;}}
    if(!changed)return;state.profile.canonical.diagnostics=Canonical.diagnoseCanonicalProfile(state.profile);state.profile.informationGaps=gapsFromDiagnostics(state.profile.canonical.diagnostics);state.approved=false;writeState(state);root.LeadIntelServerBridge?.saveNow?.().catch(()=>null);
  }
  if(typeof document!=='undefined'){
    const migrated=migrateCurrentWorkspace();if(migrated&&typeof sessionStorage!=='undefined'&&!sessionStorage.getItem(CANONICAL_MIGRATION_KEY)){sessionStorage.setItem(CANONICAL_MIGRATION_KEY,'1');setTimeout(()=>location.reload(),30);return;}
    document.addEventListener('click',event=>{if(event.target.closest('#edit-profile,#approve-profile,#approve-profile-bottom'))queueMicrotask(promoteEdits);});
  }
})(globalThis);
