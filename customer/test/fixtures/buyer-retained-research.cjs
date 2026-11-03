const D=require('../../discovery-engine.js');
const stamp=()=>new Date().toISOString();
module.exports=function fixture({company='Example',domain='example.com'}={}){
 const c={company,domain,buyerSearchMode:'user_selected_target',buyerRoles:['Executive leadership','Procurement Director','Plant Manager']};
 const names=['Anna Berg','Bo Lind','Cecilia Holm','David Lund'],roles=['Chief Executive Officer','Chief Operating Officer','Procurement Director','Plant Manager'];
 const rows=names.map((name,i)=>({url:'https://'+domain+'/team/'+i,sourceRead:true,extractedAt:stamp(),markdown:`### ${name}\n${roles[i]}\n${['anna.berg','bo.lind','cecilia.holm','david.lund'][i]}@${domain}\n${i<2?'Phone: +46 70 123 45 6'+i:''}\n${company}`}));
 c.people=D.discoverCompanyContacts(rows,c).map((p,i)=>({...p,id:'person-'+i}));const inventory=D.officialCompanyContactInventory(rows,c);
 inventory.research={policyVersion:D.OFFICIAL_CONTACT_RESEARCH_POLICY.version,status:'complete',readPages:4,completedUrls:rows.map(r=>r.url),reads:rows.map(r=>({url:r.url,status:'complete'})),checkedAt:stamp(),queries:[],failures:[]};
 c.buyerDiscovery={officialContactInventory:inventory,companyContacts:inventory.contacts,companyDossier:{status:'complete',company:c.company,domain:c.domain,overview:'Retained complete company research'}};
 c.publicResearch={evidenceVersion:2,accountability:{...D.createBuyerResearchAccountability(),officialPages:4,officialPageReads:rows.map(r=>({url:r.url,sourceRead:true,checkedAt:stamp()}))}};
 c.publicContacts=[{kind:'email',value:'info@'+domain,url:'https://'+domain+'/contact'},{kind:'phone',value:'+46 70 999 99 99',url:'https://'+domain+'/contact'}];return {c,rows};
};
