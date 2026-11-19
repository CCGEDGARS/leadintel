export const referenceQuote='Builds automated production equipment for factories';
export const opportunityQuote='Automation investments create demand for production equipment and controls.';
export function profileMain(){return {
 website:'https://seller.example/',targetMarkets:['Sweden'],answers:{priority_offers:'Production equipment',ideal_customer:'Equipment manufacturers',exclusions:'Consumer retailers',buyer_roles:'Head of Procurement'},
 referenceCustomers:{rows:[{id:'r1',companyName:'Reference',website:'https://reference.example/'}],analyses:{r1:{sourceEvidence:[{url:'https://reference.example/',quote:referenceQuote}]}}},
 market:{icps:[
  {id:'icp-core',type:'core',name:'Core',active:true,description:'Manufacturers of production equipment'},
  {id:'icp-reference-lookalike',type:'lookalike-led',name:'Lookalike',active:true,description:'Substantive reference similarity'},
  {id:'icp-trigger-led',type:'trigger-led',name:'Trigger-led',active:true,description:'Equipment manufacturers with current triggers'},
  {id:'icp-opportunity-led',type:'opportunity-led',name:'Opportunity-led',active:true,description:'A specific automation application'}
 ],signals:[{id:'hiring',name:'Engineering hiring',active:true,keywords:'production engineers'},{id:'expansion',name:'New facility',active:true,keywords:'new facility'},{id:'off',name:'Off signal',active:false},{id:'deleted',name:'Deleted signal',active:true}],deletedSignalIds:['deleted'],opportunities:[{id:'opp-automation',title:'Automation opportunity',active:true,evidence:[{url:'https://industry.example/automation',text:opportunityQuote}]}]}
};}
// Controlled provider responses retain the same source/assessment/review boundaries
// as production. Tests change coverage and review support independently.
export function profileServices({count=5,coverage=()=>({profiles:true,signals:true}),reviewChange=()=>({}),observe=()=>{}}={}){
 const date=new Date(Date.now()-86400000).toISOString().slice(0,10);
 return {
  search:async()=>Array.from({length:count},(_,i)=>({url:`https://factory${i}.example/`})),
  read:async url=>{const name='Factory'+new URL(url).hostname.match(/\d+/)[0];return {url,markdown:`${name} builds automated production equipment. ${name} operates in Stockholm, Sweden. Published ${date}: ${name} is hiring production engineers. Published ${date}: ${name} opens a new automation facility.`};},
  generate:async p=>{
   observe(p);
   if(p.stage==='plan')return {queries:p.round?[]:['Sweden production equipment manufacturers']};
   if(p.stage==='review')return {decision:'pass',identityConfirmed:true,marketConfirmed:true,commercialFitConfirmed:true,exclusionsChecked:true,supportedProfileIds:p.candidate.profileMatches.map(m=>m.profileId),supportedSignalIds:p.candidate.signalMatches.map(m=>m.signalId),reason:'Official operations, location and selected evidence support the company application.',gaps:[],...reviewChange(p.candidate)};
   const page=p.pages.at(-1),company=page.text.split(' ')[0],scope=coverage(company),base=`${company} builds automated production equipment.`;
   return {company,website:page.url,identity:{url:page.url,quote:base},location:{market:'Sweden',label:'Stockholm',url:page.url,quote:`${company} operates in Stockholm, Sweden.`},commercialFit:{status:'supported',url:page.url,quote:base,reason:'Its documented manufacturing operation uses the supplied equipment.'},
    profileMatches:p.criteria.profiles.filter(x=>scope.profiles===true||scope.profiles.includes(x.id)).map(x=>({profileId:x.id,url:page.url,quote:x.type==='opportunity-led'?`${company} opens a new automation facility.`:base,date,strength:90,reason:'The documented operations support this selected profile.',referenceId:p.criteria.references[0]?.id,referenceQuote,opportunityId:'opp-automation',opportunityQuote})),
    signalMatches:p.criteria.signals.filter(x=>scope.signals===true||scope.signals.includes(x.id)).map(x=>({signalId:x.id,url:page.url,quote:x.id==='expansion'?`${company} opens a new automation facility.`:`${company} is hiring production engineers.`,date,strength:80,reason:'A dated company-specific event supports the selected buying signal.'}))};
  }
 };
}
