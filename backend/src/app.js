import core from './index.js';
import {allowedOrigin,corsHeaders} from './security.js';
import {handleSaasRoute} from './saas-routes.js';

export default {
  async fetch(request,env){
    const origin=allowedOrigin(request,env.APP_ORIGIN);const cors=corsHeaders(origin);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
    if(request.headers.get('Origin')&&!origin)return new Response(JSON.stringify({error:'Origin not allowed'}),{status:403,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...cors}});
    try{
      const saas=await handleSaasRoute(request,env,cors);if(saas)return saas;
      return core.fetch(request,env);
    }catch(cause){
      console.error(cause);return new Response(JSON.stringify({error:'Internal server error'}),{status:500,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...cors}});
    }
  }
};
