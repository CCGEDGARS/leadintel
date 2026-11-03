import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),D=require('../../customer/discovery-engine.js'),receipts=require('../../customer/test/helpers/buyer-research-receipts.cjs');
export function paidCandidate(){
 const stamp=new Date().toISOString(),c={company:'Forge Industries',domain:'forge.example',buyerSearchMode:'user_selected_target',buyerRoles:['Procurement Director'],qualification:{eligible:true,companyScore:85,score:85,researchedAt:stamp},people:Array.from({length:4},(_,i)=>({id:'buyer-'+i,name:['Anna Buyer','Bo Buyer','Cecilia Buyer','David Buyer'][i],title:'Procurement Director',organization:'Forge Industries',publicNameUrl:'https://forge.example/team',identityStatus:'confirmed',nameVerification:'confirmed',emailResearch:{status:'complete',checkedAt:stamp,searches:9,failed:0}})),buyerDiscovery:{},publicResearch:{accountability:{...D.createBuyerResearchAccountability(),status:'complete',checkedPeople:4,totalPeople:4,completedAt:stamp}}};
 receipts(c);c.publicResearch.aiReview={status:'complete',provider:'controlled-review',checkedAt:stamp,reviewedPersonIds:c.people.map(p=>p.id),findings:[],conflicts:[],inputSignature:D.buyerReviewSignature(c)};
 return c;
}
