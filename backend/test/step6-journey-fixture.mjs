import {createRequire} from 'node:module';
import {journeyFixture,workspaceId,sessionToken,sourceUrl} from './step5-journey-fixture.mjs';
import {encryptSecret,importAesKey} from '../src/oauth.js';

const require=createRequire(import.meta.url);
const Profile=require('../../customer/profile-engine.js');
const Canonical=require('../../customer/canonical-intelligence.js');
export const reviewedLinkedInUrl='https://www.linkedin.com/in/robert-lund';

// Only the external provider is controlled. Authentication, migrations, routes,
// workspace CAS, CRM contact confirmation and CRM snapshots execute normally.
export async function step6Fixture(){
 const providerRequests=[];let nextFailure=null,nextGate=null;
 const f=await journeyFixture({externalFetch:async(input,options)=>{
  const url=new URL(typeof input==='string'?input:input.url);
  if(url.hostname!=='api.openai.com')return;
  const body=JSON.parse(options.body),data=JSON.parse(body.input||'{}');
  const request={kind:body.tools?'research':data.sources?'fields':data.context?.channel==='linkedin'?'linkedin':'other',style:data.style||data.mode||null,status:'pending'};
  providerRequests.push(request);
  if(request.kind==='fields'&&nextGate){const gate=nextGate;nextGate=null;gate.started();await gate.wait;}
  if(request.kind==='fields'&&nextFailure){const failure=nextFailure;nextFailure=null;request.status=failure;
   if(failure==='unavailable')return Response.json({error:{message:'Controlled provider unavailable'}},{status:503});
   return Response.json({output_text:JSON.stringify({...data.sources,unauthorizedSentence:'Forbidden whole-message field'}),usage:{input_tokens:10,output_tokens:20}});
  }
  request.status='complete';
  // Echo already valid English factual slots exactly, never supply whole copy.
  const output=request.kind==='linkedin'?{message:'Hello '+data.context.firstName+',\n\nI’m '+data.essentials.sender+' from '+data.essentials.company+'. Would you be open to a 20-minute Zoom conversation?\n\n'+data.essentials.calendly}:body.tools?{results:[]}:data.sources||{};
  return Response.json({output_text:JSON.stringify(output),...(body.tools?{output:[{type:'web_search_call',status:'completed',action:{sources:[]}}]}:{}),usage:{input_tokens:10,output_tokens:20}});
 }});
 try{
  f.env.OAUTH_TOKEN_ENCRYPTION_KEY=Buffer.alloc(32,7).toString('base64');
  const aes=await importAesKey(f.env.OAUTH_TOKEN_ENCRYPTION_KEY);
  f.DB.raw.prepare('INSERT INTO workspace_ai_integrations(workspace_id,provider,encrypted_api_key,key_hint,model,active) VALUES(?,?,?,?,?,1)').run(workspaceId,'openai',await encryptSecret('step6-fixture-key',aes),'fixture','gpt-6.1-sol');
  const saved=await f.getState(),main=saved.payload.main;
  main.answers={...main.answers,buying_outcomes:'production flow downtime',value_proposition:'simplify production flow',differentiation:'Our team supports industrial projects.',proof_points:'No approved proof yet',objections:'Unknown',delivery_approach:'Project-specific engineering and installation.',meeting_value:'relevant project lessons'};
  main.answerStatus=Object.fromEntries(Object.keys(main.answers).map(key=>[key,'user']));
  main.brandIdentity={senderName:'Robin Lane',senderTitle:'Commercial Director',companyDisplayName:'Fixture Industrial',website:'https://seller.example',email:'robin@seller.example',linkedinUrl:'https://www.linkedin.com/in/robin-lane'};
  main.messageStudio={};
  main.profile=Profile.buildCompanyIntelligenceProfile(main);Canonical.confirmProfileContext(main);main.approved=true;
  await f.replace(saved.payload,saved.version);
  // Establish test contacts through the same official-source confirmation route
  // used by Buyers, so visible Proceed has a real, authorized CRM recipient.
  let robertContact;
  for(const person of f.candidate.people){
   const response=await fetch(f.origin+'/api/crm/companies/'+f.candidate.crmId+'/confirm-public-email?workspace_id='+workspaceId,{method:'POST',headers:{Cookie:'leadintel_session='+sessionToken,'Content-Type':'application/json'},body:JSON.stringify({name:person.publicName||person.name,title:person.title,person_id:person.id,email:person.publicEmail,source_url:sourceUrl})});
   if(!response.ok)throw Error('Step 6 official contact fixture failed: '+await response.text());
   if(person.id==='robert')robertContact=(await response.json()).contact;
  }
  // The synthetic profile begins unconfirmed. Its CRM copy uses normal routes;
  // the browser must complete the actual Review profile dialog and guards.
  const patch=await fetch(f.origin+'/api/crm/contacts/'+robertContact.id+'?workspace_id='+workspaceId,{method:'PATCH',headers:{Cookie:'leadintel_session='+sessionToken,'Content-Type':'application/json'},body:JSON.stringify({linkedin_url:reviewedLinkedInUrl})});
  if(!patch.ok)throw Error('Step 6 reviewed LinkedIn contact fixture failed: '+await patch.text());
  const linkedState=await f.getState(),company=linkedState.payload.discovery.selectedProspects[0],person=company.people.find(person=>person.id==='robert');
  person.publicLinkedinUrl=reviewedLinkedInUrl;
  await f.replace(linkedState.payload,linkedState.version);
  return {...f,providerRequests,failNextPreparation(kind='unavailable'){nextFailure=kind;},holdNextPreparation(){
   let started,release;const began=new Promise(resolve=>started=resolve),wait=new Promise(resolve=>release=resolve);
   nextGate={started,wait};return {began,release};
  }};
 }catch(error){await f.close();throw error;}
}
