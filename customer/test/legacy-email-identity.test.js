const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','outreach-ui.js'),'utf8');
const a=src.indexOf('function repairLegacyEmailIdentity('),b=src.indexOf('function unresolvedEmailMarkers(',a);
assert.ok(a>=0&&b>a,'Legacy repair function must remain available');
const Approved=require('../approved-reference-scripts.js');
function run(item,sender='Edgars Untāls'){
 let saved=null;const inputs={'outreach-email-body':{value:''},'outreach-email-subject':{value:''}};
 const fn=new Function('mainState','workingSuggestedSubject','upsertItem','q','globalThis',src.slice(a,b)+';return repairLegacyEmailIdentity;')(
 ()=>({brandIdentity:{senderName:sender}}),()=> 'Edgars Untāls. ERCON',value=>saved=value,id=>inputs[id],{LeadIntelApprovedReferences:Approved});
 return {changed:fn(item,{mode:'professional'},{}),saved,inputs};
}
test('old NLP original restores Professional default and saved sender name',()=>{
 const item={channel:'email',approved:false,messageStudioDraft:{generatedAt:''},drafts:{emailSubject:'Malmberget 2028: the steel behind the schedule',emailBody:"Hi Joakim,\n\nI'm (First name Second name) from ERCON."}};
 const result=run(item);assert.equal(result.changed,true);
 assert.equal(result.saved.drafts.emailSubject,'Edgars Untāls. ERCON');
 assert.match(result.saved.drafts.emailBody,/I'm Edgars Untāls from ERCON/);
});
test('do not modify previously generated customer drafts',()=>{
 const item={channel:'email',approved:false,messageStudioDraft:{generatedAt:'2026-10-08T19:00:00Z'},drafts:{emailSubject:'Malmberget 2028: the steel behind the schedule',emailBody:'Custom approved text'}};
 const result=run(item);assert.equal(result.changed,false);assert.equal(result.saved,null);
});
test('do not invent sender surname when profile is incomplete',()=>{
 const item={channel:'email',approved:false,messageStudioDraft:{},drafts:{emailSubject:'Custom subject',emailBody:"I'm (First name Second name) from ERCON."}};
 const result=run(item,'Edgars');assert.equal(result.changed,false);
});
