const D=require('../../discovery-engine.js'),recording=require('./viscaria-current-contact-sources.json');
module.exports=function replay(){
 const stamp=new Date().toISOString(),pages=recording.pages.map(r=>({...r,sourceRead:true,extractedAt:stamp})),searches=recording.searches.map(r=>({...r,retrievedAt:stamp}));
 const c={company:'Viscaria',domain:'viscaria.com',buyerSearchMode:'user_selected_target',buyerRoles:['Executive leadership','Procurement Director','Engineering Director','Operations Director','Project Director'],people:[]},profile={decisionMakers:c.buyerRoles};
 c.people=D.mergeBuyerPool(D.discoverCompanyContacts(pages,c),D.tracePublicBuyers(searches,c.company,profile).people,profile);c.people=D.matchPublicLinkedInProfiles(c.people,searches,c.company);
 c.buyerDiscovery={companyContacts:D.discoverCompanyContacts(pages,c),officialContactInventory:D.officialCompanyContactInventory(pages,c)};
 return {c,pages,searches,recordedAt:recording.retrievedAt};
};
