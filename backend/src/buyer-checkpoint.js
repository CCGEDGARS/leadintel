import budget from '../../customer/state-budget.js';

const format='buyer-checkpoint-v1';
export const buyerRecordLimitMessage='CRM & workspace data has too little space to save buyer research. Resume to compact saved research and continue. Files have a separate allowance.';
export function buyerRecordLimit(reason=''){
 return reason===buyerRecordLimitMessage||reason.startsWith('Workspace storage is full.')||/^workspace_records_full:\d+$/.test(reason);
}
export function readBuyerCheckpoint(text,fallback={}){
 let stored;
 try{stored=JSON.parse(text);}catch{return fallback;}
 if(stored?.format!==format)return stored;
 const restored=budget.restoreWorkspaceSnapshot(stored.snapshot);
 if(stored.snapshot?.format!=='leadintel-workspace-snapshot-lzw-v1'||!restored?.data)throw Error('Invalid stored buyer research checkpoint');
 return restored.data;
}

// SQLite selects rosters, contact receipt owners and scheduler recovery flags
// without inflating every historical checkpoint. Payload readers restore the original.
export function compactBuyerCheckpoint(raw){
 if(raw.length<32768)return raw;
 const candidate=JSON.parse(raw);
 if(!candidate||candidate.format||typeof candidate!=='object'||Array.isArray(candidate))return raw;
 const snapshot=budget.packWorkspaceSnapshot({data:candidate});
 if(snapshot.format!=='leadintel-workspace-snapshot-lzw-v1')return raw;
 const people=candidate.people?.map(person=>({id:person.id,contactResearch:{policyVersion:person.contactResearch?.policyVersion,identityKey:person.contactResearch?.identityKey}}));
 const research=candidate.buyerDiscovery?.officialContactInventory?.research;
 const audit=candidate.publicResearch;
 const packed=JSON.stringify({format,snapshot,people,domain:candidate.domain,company:candidate.company,
  buyerDiscovery:{officialContactInventory:{research:{status:research?.status,discoveryScope:research?.discoveryScope}}},
  publicResearch:{accountability:{status:audit?.accountability?.status,stopReason:audit?.accountability?.stopReason},buyerAgent:{status:audit?.buyerAgent?.status},aiReview:{status:audit?.aiReview?.status}}});
 if(new TextEncoder().encode(packed).length>=new TextEncoder().encode(raw).length||JSON.stringify(budget.restoreWorkspaceSnapshot(snapshot).data)!==raw)return raw;
 return packed;
}
