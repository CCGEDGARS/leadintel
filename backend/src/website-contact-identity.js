import {websiteNameKey,websiteProfileKey,websiteContactRole,websiteFreeResearchComplete} from './website-contact-evidence.js';
import '../../customer/discovery-engine.js';
const D=globalThis.LeadIntelDiscovery;
export const WEBSITE_IDENTITY_REVIEW_VERSION=1;

// Repair derived identity grouping from existing server-owned receipts. This
// does not acquire a source, approve a person, or purchase contact data.
export function reconcileWebsiteContactIdentities(state,input){
 const searches=(state.tasks||[]).filter(t=>t.status==='complete'&&t.kind==='search'&&!t.archived&&Date.now()-Date.parse(t.checkedAt||'')>=0&&Date.now()-Date.parse(t.checkedAt||'')<30*86400000),rows=searches.flatMap(t=>Array.isArray(t.result)?t.result:[]),sourceDates=new Map();
 for(const task of searches)for(const row of Array.isArray(task.result)?task.result:[]){const key=websiteProfileKey(row.url);if(key&&Date.parse(task.checkedAt)>Date.parse(sourceDates.get(key)||'1970-01-01'))sourceDates.set(key,task.checkedAt);}
 const previous=state.people||[],matched=D.matchPublicLinkedInProfiles(previous,rows,input.company),people=[],archived=[...(state.identityArchive||[])];
 for(const person of matched){
  // Replaying saved evidence is not a new source acquisition or freshness reset.
  const stamp=sourceDates.get(websiteProfileKey(person.linkedinIdentityEvidence?.url));if(stamp&&person.linkedinIdentityEvidence)person.linkedinIdentityEvidence={...person.linkedinIdentityEvidence,checkedAt:stamp};
  const name=websiteNameKey(person.publicName||person.name),profile=websiteProfileKey(person.publicLinkedinUrl||person.linkedin_url),same=people.filter(p=>websiteNameKey(p.publicName||p.name)===name&&websiteNameKey(p.organization)===websiteNameKey(person.organization)&&websiteContactRole(p.title)===websiteContactRole(person.title)&&(!profile||!websiteProfileKey(p.publicLinkedinUrl||p.linkedin_url)||profile===websiteProfileKey(p.publicLinkedinUrl||p.linkedin_url)));
  // Without a profile, only duplicate rows from the same actual source may
  // join. Otherwise a shared full name and title can still be two people.
  const prior=same.length===1?same[0]:null,priorProfile=prior&&websiteProfileKey(prior.publicLinkedinUrl||prior.linkedin_url),sameSource=prior?.publicNameUrl===person.publicNameUrl;
  const mayJoin=prior&&(profile&&priorProfile&&profile===priorProfile||sameSource&&(!profile||!priorProfile)||prior.identityOrigin==='official'&&person.identityOrigin==='official'&&sameSource);
  // Never silently combine independently saved paid outcomes.
  if(!mayJoin||prior.contactData&&person.contactData){people.push(person);continue;}
  const keep=person.contactData&&!prior.contactData?person:prior,removed=keep===prior?person:prior;
  const aliases=[...new Set([...(prior.identitySourceIds||[]),...(person.identitySourceIds||[]),prior.id,person.id])].slice(0,30);
  if(keep.identityOrigin!=='official'&&removed.identityOrigin==='official'){keep.identityOrigin='official';keep.publicNameUrl=removed.publicNameUrl;if(!keep.contactData){keep.name=removed.name;keep.publicName=removed.publicName||removed.name;}}
  if(!keep.publicLinkedinUrl&&removed.publicLinkedinUrl)keep.publicLinkedinUrl=removed.publicLinkedinUrl;
  keep.identitySourceIds=aliases;
  if(!archived.some(p=>p.id===removed.id))archived.push({...removed,consolidatedInto:keep.id});
  if(keep!==prior)people[people.indexOf(prior)]=keep;
 }
 const names=new Map();for(const p of people){const key=websiteNameKey(p.publicName||p.name);names.set(key,(names.get(key)||0)+1);}
 for(const p of people){
  const wasConflict=p.identityConflict;p.identityConflict=names.get(websiteNameKey(p.publicName||p.name))>1;
  if(p.identityConflict&&p.freeResearchStatus==='complete')delete p.freeResearchStatus;
  // Re-evaluate only a previous identity hold, using the unchanged complete
  // mandatory-check receipts. Missing/failed checks cannot become complete.
  if(wasConflict&&!p.identityConflict&&p.freeResearchStatus==='needs_review'&&websiteFreeResearchComplete({company:input.company,domain:input.domain,people:[p]},p))p.freeResearchStatus='complete';
 }
 state.people=people;state.identityArchive=archived.slice(-300);state.identityReviewVersion=WEBSITE_IDENTITY_REVIEW_VERSION;
 return state;
}
