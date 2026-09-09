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
    const publishedModel=normalizePublishedModel(raw.publishedModel)||legacyPublishedModel(raw,normalized);
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
