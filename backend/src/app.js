import core from './index.js';
import {allowedOrigin,corsHeaders} from './security.js';
import {handleAiRoute} from './ai-routes.js';
import {handleSaasRoute} from './saas-routes.js';
import {handleCrmRoute} from './crm-routes.js';
import {handleApolloCrmWebhook} from './crm-routes.js';

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname==='/api/webhooks/apollo/crm-contact'){
      try{return await handleApolloCrmWebhook(request,env,{});}catch(cause){console.error(cause);return new Response(JSON.stringify({error:'Internal server error'}),{status:500,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});}
    }
    const origin=allowedOrigin(request,env.APP_ORIGIN);const cors=corsHeaders(origin);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
    if(request.headers.get('Origin')&&!origin)return new Response(JSON.stringify({error:'Origin not allowed'}),{status:403,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...cors}});
    try{
      const ai=await handleAiRoute(request,env,cors);if(ai)return ai;
      const crm=await handleCrmRoute(request,env,cors);if(crm)return crm;
      const saas=await handleSaasRoute(request,env,cors);if(saas)return saas;
      return core.fetch(request,env);
    }catch(cause){
      console.error(cause);return new Response(JSON.stringify({error:'Internal server error'}),{status:500,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...cors}});
    }
  }
};
