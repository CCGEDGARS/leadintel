(function installReferenceCustomerLibrary(root){
  'use strict';
  const Ref=root?.LeadIntelReferenceCustomers||(typeof module!=='undefined'&&module.exports?require('./reference-customers.js'):null);
  if(!Ref)return;
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
  const baseNormalize=Ref.normalizeReferenceState.bind(Ref);
  const baseActivateCustomers=Ref.activateReferenceCustomers.bind(Ref);
  const baseActivateSegments=Ref.activateReferenceSegments.bind(Ref);
  const baseGetActive=Ref.getActiveReferenceModel.bind(Ref);

  function normalizePublishedModel(value){
    if(!value||typeof value!=='object'||value.active===false||!value.dna||typeof value.dna!=='object')return null;
    if(value.dna.calibrationVersion===1&&!value.dna.dimensions?.length)return null;
    const fingerprint=clean(value.fingerprint||value.dna.fingerprint);
    if(!fingerprint)return null;
    const activeRows=Array.isArray(value.activeRows)?clone(value.activeRows):[];
    const activeSegments=Array.isArray(value.activeSegments)?clone(value.activeSegments):[];
    const activeCount=Math.max(0,Number(value.activeCount||value.dna.activeCount||activeRows.length)||0);
    return {
      version:1,
      active:true,
      fingerprint,
      activeCount,
      confidence:clean(value.confidence||value.dna.confidence)||'low',
      dna:{...clone(value.dna),active:true,fingerprint,activeCount:Number(value.dna.activeCount||activeCount)||activeCount},
      activeRows,
      activeSegments,
      segmentIds:Array.isArray(value.segmentIds)?[...new Set(value.segmentIds.map(clean).filter(Boolean))]:activeSegments.map(segment=>clean(segment.id)).filter(Boolean),
      activatedAt:clean(value.activatedAt||value.dna.builtAt),
      updatedAt:clean(value.updatedAt||value.activatedAt||value.dna.builtAt)
    };
  }

  function recalibrateStoredDna(value={}){
    const sampleSize=Math.max(0,Number(value.sampleSize||value.activeCount)||0),threshold=sampleSize<=1?1:Math.max(2,Math.ceil(sampleSize*.6));
    if(!sampleSize)return null;
    const dimensions=(value.dimensions||[]).map(dimension=>{
      const strongest=clean(dimension?.values?.[0]),evidenceCount=Math.max(0,Number(dimension?.evidenceCount)||0);
      if(!strongest||evidenceCount<threshold)return null;
      const prevalence=evidenceCount/sampleSize;
      const confidence=sampleSize<=1?'low':sampleSize<=3?'medium':prevalence>=.8&&clean(dimension.confidence)==='high'?'high':'medium';
      return {...dimension,label:clean(dimension.label)||clean(dimension.key),values:[strongest],evidenceByValue:{[strongest]:evidenceCount},evidenceCount,supportThreshold:threshold,prevalence:Number(prevalence.toFixed(2)),confidence};
    }).filter(Boolean);
    if(!dimensions.length)return null;
    const strongDimensions=dimensions.filter(dimension=>dimension.confidence==='high'&&dimension.prevalence>=.8).length;
    const confidence=sampleSize<=1?'low':strongDimensions>=2&&clean(value.profileConfidence||value.confidence)==='high'?'high':'medium';
    return {...clone(value),version:3,calibrationVersion:1,active:true,activeCount:sampleSize,sampleSize,confidence,profileConfidence:confidence,dimensions,profileSummary:`Recalibrated from recorded support across ${sampleSize} reference companies. Only traits meeting the ${threshold}/${sampleSize} support threshold are retained.`};
  }
  function recalibratePublishedModel(publishedModel,referenceState={}){
    if(!publishedModel||publishedModel.dna?.calibrationVersion===1)return publishedModel;
    const publishedIds=(publishedModel.activeRows||[]).map(row=>clean(row?.id)).filter(Boolean),hasFullAnalysis=publishedIds.length===publishedModel.activeCount&&publishedIds.every(id=>{
      const analysis=referenceState.analyses?.[id];return Boolean(analysis&&Object.keys(analysis).some(key=>key!=='confidence'&&clean(Array.isArray(analysis[key])?analysis[key].join(' '):analysis[key])));
    });
    if(hasFullAnalysis){
      const candidate=baseNormalize({...referenceState,activated:true,activeIds:publishedIds,activeSegmentIds:publishedModel.segmentIds||[],fingerprint:publishedModel.fingerprint,dna:null});
      const calibrated=Ref.buildReferenceDna(candidate,candidate.analyses||{});
      if(calibrated)return normalizePublishedModel({...publishedModel,confidence:calibrated.confidence,dna:calibrated,activeCount:calibrated.activeCount,activeRows:candidate.rows.filter(row=>publishedIds.includes(row.id)),activeSegments:candidate.segments.filter(segment=>(publishedModel.segmentIds||[]).includes(segment.id))});
    }
    const calibrated=recalibrateStoredDna(publishedModel.dna||{});
    return calibrated?normalizePublishedModel({...publishedModel,confidence:calibrated.confidence,dna:calibrated}):null;
  }

  function legacyPublishedModel(raw,normalized){
    if(!normalized.activated||!normalized.dna?.active)return null;
    const legacy=baseGetActive(normalized);if(!legacy)return null;
    return normalizePublishedModel({
      active:true,
      fingerprint:legacy.fingerprint,
      activeCount:normalized.dna.activeCount||legacy.activeRows.length,
      confidence:normalized.dna.confidence,
      dna:normalized.dna,
      activeRows:legacy.activeRows,
      activeSegments:legacy.activeSegments,
      segmentIds:legacy.activeSegments.map(segment=>segment.id),
      activatedAt:normalized.activatedAt||normalized.dna.builtAt,
      updatedAt:normalized.activatedAt||normalized.dna.builtAt
    });
  }

  function normalizeReferenceState(value={}){
    const raw=value&&typeof value==='object'?value:{};
    const normalized=baseNormalize(raw);
    let publishedModel=normalizePublishedModel(raw.publishedModel)||legacyPublishedModel(raw,normalized);
    if(publishedModel&&publishedModel.dna.calibrationVersion!==1)publishedModel=recalibratePublishedModel(publishedModel,normalized);
    const explicitDirty=raw.draftDirty===true;
    const implicitDirty=Boolean(publishedModel&&(!normalized.activated||!normalized.dna||normalized.fingerprint!==publishedModel.fingerprint));
    return {
      ...normalized,
      version:3,
      publishedModel,
      draftDirty:Boolean(publishedModel&&(explicitDirty||implicitDirty)),
      updatedAt:clean(raw.updatedAt)||clean(normalized.analyzedAt)||clean(publishedModel?.updatedAt)
    };
  }

  function preservePublished(input,next){
    const source=normalizeReferenceState(input);
    return normalizeReferenceState({...next,publishedModel:source.publishedModel,draftDirty:source.draftDirty,updatedAt:source.updatedAt});
  }

  function activateReferenceCustomers(state={},ids=[]){return preservePublished(state,baseActivateCustomers(state,ids));}
  function activateReferenceSegments(state={},segmentIds=[]){return preservePublished(state,baseActivateSegments(state,segmentIds));}

  function markReferenceDraftChanged(state={}){
    const normalized=normalizeReferenceState(state);
    return normalizeReferenceState({
      ...normalized,
      activeSegmentIds:[],
      activeIds:[],
      activated:false,
      fingerprint:'',
      dna:null,
      activatedAt:'',
      publishedModel:normalized.publishedModel,
      draftDirty:Boolean(normalized.publishedModel?.active),
      updatedAt:new Date().toISOString()
    });
  }

  function publishReferenceModel(state={}){
    const normalized=normalizeReferenceState(state);
    const draft=baseGetActive(normalized);
    if(!draft||!normalized.dna?.active)return normalized;
    const now=new Date().toISOString();
    const publishedModel=normalizePublishedModel({
      active:true,
      fingerprint:draft.fingerprint,
      activeCount:normalized.dna.activeCount||draft.activeRows.length,
      confidence:normalized.dna.confidence,
      dna:normalized.dna,
      activeRows:draft.activeRows,
      activeSegments:draft.activeSegments,
      segmentIds:draft.activeSegments.map(segment=>segment.id),
      activatedAt:normalized.activatedAt||now,
      updatedAt:now
    });
    return normalizeReferenceState({...normalized,publishedModel,draftDirty:false,updatedAt:now});
  }

  function getActiveReferenceModel(state={}){
    const normalized=normalizeReferenceState(state);
    const published=normalized.publishedModel;
    if(published?.active){
      return {
        active:true,
        fingerprint:published.fingerprint,
        activeRows:clone(published.activeRows||[]),
        activeSegments:clone(published.activeSegments||[]),
        dna:clone(published.dna),
        published:true,
        activatedAt:published.activatedAt,
        updatedAt:published.updatedAt
      };
    }
    return baseGetActive(normalized);
  }

  Ref.normalizeReferenceState=normalizeReferenceState;
  Ref.activateReferenceCustomers=activateReferenceCustomers;
  Ref.activateReferenceSegments=activateReferenceSegments;
  Ref.markReferenceDraftChanged=markReferenceDraftChanged;
  Ref.publishReferenceModel=publishReferenceModel;
  Ref.getActiveReferenceModel=getActiveReferenceModel;
  Ref.normalizePublishedModel=normalizePublishedModel;

  const api={normalizeReferenceState,activateReferenceCustomers,activateReferenceSegments,markReferenceDraftChanged,publishReferenceModel,getActiveReferenceModel,normalizePublishedModel};
  root.LeadIntelReferenceCustomerLibrary=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
