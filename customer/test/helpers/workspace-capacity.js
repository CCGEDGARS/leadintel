function fixture(){
 const records=Array.from({length:70},(_,i)=>({url:`https://buyer.example/evidence/${i}`,quote:`Source ${i}: `+'Verified company context. '.repeat(127),date:'2026-10-11',accepted:i%2===0}));
 return {main:{website:'https://seller.example',notes:'Profile notes. '.repeat(6300)},discovery:{selectedProspects:[{domain:'buyer.example',people:[{id:'buyer-1',kept:true}],publicResearch:{records}}]},outreach:{items:[{id:'message-1',domain:'buyer.example',dossier:{records},drafts:{emailSubject:'Project discussion',emailBody:'Exact saved wording.'},approved:true}],messageStudio:{originalScripts:{'email:professional:sv':{body:'Protected original.',revision:1,locked:true,history:[]}}}},delivery:{history:[{id:'sent-1',status:'sent'}]},meta:{discovery:{scriptBuyer:{domain:'buyer.example',personId:'buyer-1',workspaceId:'w1'},notes:'Selection notes. '.repeat(2800)},persistence:{explicit_saved:true}}};
}
module.exports=fixture;
