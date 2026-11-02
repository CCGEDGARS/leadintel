import {storageDb} from './workspace-storage-fixture.mjs';
import {sha256} from '../src/security.js';
import {putCustomerState} from '../src/customer-state.js';

export const workspaceId='storage-w1',foreignWorkspaceId='storage-w2';
export function buyerCandidate(){return {domain:'forge.example',company:'Forge Industries',buyerRoles:['Head of Procurement'],buyerSearchMode:'user_selected_target',people:[{id:'robert',name:'Robert Lund',publicName:'Robert Lund',title:'Head of Procurement',organization:'Forge Industries',publicNameUrl:'https://forge.example/team',kept:true}]};}
export async function buyerJobsFixture(t){
 const DB=storageDb();t.after(()=>DB.raw.close());const env={DB,APP_ORIGIN:'https://app.fixture.test',CUSTOMER_APP_URL:'https://app.fixture.test/customer/'};
 const users={};
 for(const role of ['owner','researcher','sales','viewer','foreign']){
  const id=role==='owner'?'storage-owner':'buyer-'+role,token='controlled-buyer-'+role,sessionTokenHash=await sha256(token);
  if(role!=='owner')DB.raw.prepare('INSERT INTO users(id,email,display_name,role) VALUES(?,?,?,?)').run(id,role+'@fixture.example',role,role==='foreign'?'owner':role);
  if(role!=='owner')DB.raw.prepare('INSERT INTO workspace_members(workspace_id,user_id,role) VALUES(?,?,?)').run(role==='foreign'?foreignWorkspaceId:workspaceId,id,role==='foreign'?'owner':role);
  DB.raw.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,datetime('now','+1 day'))").run(sessionTokenHash,id);
  users[role]={id,token,sessionTokenHash,role:role==='foreign'?'owner':role};
 }
 const candidate=buyerCandidate(),main={website:'https://seller.example/',targetMarkets:['Sweden'],answers:{priority_offers:'industrial automation',ideal_customer:'manufacturers',buyer_roles:'Head of Procurement',exclusions:''},profile:{companyName:'Fixture seller',priorityOffers:'industrial automation',idealCustomer:'manufacturers',decisionMakers:'Head of Procurement',targetMarkets:'Sweden'}};
 const payload={main,discovery:{selectedProspects:[candidate]}};
 await putCustomerState(env,{workspaceId,userId:users.owner.id,expectedVersion:0,payload});
 return {env,DB,users,candidate,payload,body:{action:'start',candidate}};
}
