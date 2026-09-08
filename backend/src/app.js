import core from './index.js';
import {allowedOrigin,corsHeaders} from './security.js';
import {handleAiRoute} from './ai-routes.js';
import {handleServiceIntegrationRoute,withWorkspaceServiceCredentials} from './service-integrations.js';
import {handleScraplingRoute} from './scrapling-routes.js';
import {handleSaasRoute} from './saas-routes.js';
import {handleOutreachAutomationRoute} from './outreach-automation-routes.js';
import {runOutreachAutomation} from './outreach-automation-runner.js';
import {pollOutreachReplies} from './outreach-automation-replies.js';
import {handleCrmRoute} from './crm-routes.js';
import {handleApolloCrmWebhook} from './crm-routes.js';
import {handleMarketMonitoringRoute,runDueMarketMonitoring} from './market-monitoring.js';

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
      const scrapling=await handleScraplingRoute(request,env,cors);if(scrapling)return scrapling;
      const service=await handleServiceIntegrationRoute(request,env,cors);if(service)return service;
      const monitoring=await handleMarketMonitoringRoute(request,env,cors);if(monitoring)return monitoring;
      const runtimeEnv=await withWorkspaceServiceCredentials(request,env);
      const crm=await handleCrmRoute(request,runtimeEnv,cors);if(crm)return crm;
      const automation=await handleOutreachAutomationRoute(request,runtimeEnv,cors);if(automation)return automation;
      const saas=await handleSaasRoute(request,runtimeEnv,cors);if(saas)return saas;
      return core.fetch(request,runtimeEnv);
    }catch(cause){
      console.error(cause);return new Response(JSON.stringify({error:'Internal server error'}),{status:500,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...cors}});
    }
  },
  async scheduled(controller,env,ctx){
    const now=new Date(controller.scheduledTime||Date.now());
    const outreachCycle=pollOutreachReplies(env,{now}).then(()=>runOutreachAutomation(env,{now}));
    ctx.waitUntil(Promise.allSettled([
      runDueMarketMonitoring(env,now),
      outreachCycle
    ]));
  }
};
