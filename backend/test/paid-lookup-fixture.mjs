export async function controlledLookup(f,calls){
 const {lookupAdditionalEmail}=await import('../src/additional-contact-services.js'),{findTregWorkEmail}=await import('../src/treg-contact-research.js');
 const credential=async()=>({configured:true,source:'customer',apiKey:'controlled-key'});
 return (env,context,company,input,deps)=>lookupAdditionalEmail(env,context,company,input,{...deps,credential,findTreg:(e,ctx,c,p,id,options)=>findTregWorkEmail(e,ctx,c,p,id,options,{credential,fetch:async(url,options)=>{
  const body=JSON.parse(options.body||'{}');calls.push({url,body,key:options.headers['Idempotency-Key']});const email=body.email||body.full_name?.toLowerCase().replace(/ /g,'.')+'@forge.example';
  const output=url.includes('email.find')?{email,full_name:body.full_name}:url.includes('email.verify')?{email,status:'valid'}:url.includes('phone.find')?{full_name:body.full_name,phone:'+46701234567'}:{full_name:body.full_name,title:'Procurement Director',company_name:'Forge Industries'};
  return Response.json({output,raw:url.includes('email.verify')?{email,result:'deliverable',is_accept_all:false}:{}},{headers:{'X-Treg-Call-Id':'controlled-'+calls.length,'X-Treg-Cost-Micro':'1000'}});
 }})});
}
