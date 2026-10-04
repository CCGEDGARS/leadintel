// Fixed upstream only. Keep cookies HttpOnly and out of JavaScript/JSON/logs.
const UPSTREAM='https://leadintel-api.edgars-7e7.workers.dev';
const REQUEST_HEADERS=['accept','content-type','cookie','origin','x-csrf-token','idempotency-key'];
export async function proxyRequest(request,fetchImpl=fetch){
  const incoming=new URL(request.url);const route=incoming.searchParams.get('route');
  if(!route||! /^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$/.test(route)||route.split('/').includes('..'))return new Response('Invalid API route',{status:400});
  incoming.searchParams.delete('route');const target=new URL('/api/'+route,UPSTREAM);target.search=incoming.search;
  const headers=new Headers();for(const name of REQUEST_HEADERS){const value=request.headers.get(name);if(value)headers.set(name,value);}
  headers.set('x-leadintel-first-party','1');
  const response=await fetchImpl(target,{method:request.method,headers,redirect:'manual',...(!['GET','HEAD'].includes(request.method)?{body:await request.arrayBuffer()}:{}),signal:request.signal});
  const out=new Headers({'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
  for(const name of ['content-type','location','retry-after','content-disposition']){const value=response.headers.get(name);if(value)out.set(name,value);}
  // No Domain attribute: the browser installs this cookie on the app host.
  for(const cookie of response.headers.getSetCookie())out.append('Set-Cookie',cookie);
  return new Response(response.body,{status:response.status,headers:out});
}
export default async function handler(req,res){
  try{
    const headers=new Headers();for(const [name,value] of Object.entries(req.headers))if(value!==undefined)headers.set(name,Array.isArray(value)?value.join(','):value);
    let body;
    if(!['GET','HEAD'].includes(req.method)){
      if(req.body!==undefined)body=Buffer.isBuffer(req.body)?req.body:typeof req.body==='string'?req.body:JSON.stringify(req.body);
      else{const chunks=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));body=Buffer.concat(chunks);}
    }
    const incoming=new URL(req.url,'https://leadintel.ccgroup.lv');
    if(req.query?.route)incoming.searchParams.set('route',String(req.query.route));
    const response=await proxyRequest(new Request(incoming,{method:req.method,headers,...(body!==undefined?{body}:{})}));
    res.statusCode=response.status;for(const [name,value] of response.headers)if(name!=='set-cookie')res.setHeader(name,value);
    const cookies=response.headers.getSetCookie();if(cookies.length)res.setHeader('Set-Cookie',cookies);
    res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.statusCode=502;res.setHeader('Cache-Control','no-store');res.end('LeadIntel backend unavailable');}
}
