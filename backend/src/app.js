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
import {handleIntelligenceSourceRoute,runDueSourceHealthChecks} from './intelligence-sources.js';
import {handleCopilotRoute} from './copilot-routes.js';
import {handleBrandAssetRoute} from './brand-assets.js';

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname==='/api/webhooks/apollo/crm-contact'){
      try{return await handleApolloCrmWebhook(request,env,{});}catch(cause){console.error(cause);return new Response(JSON.stringify({error:'Internal server error'}),{status:500,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});}
    }
    const origin=allowedOrigin(request,env.APP_ORIGIN);
    const cors=corsHeaders(origin);
    const publicBrandAsset=
      request.method==='GET'&&
      url.pathname.startsWith('/api/customer/brand-assets/')&&
      url.pathname!=='/api/customer/brand-assets/import';
    if(publicBrandAsset){
      try{
        return await handleBrandAssetRoute(request,env,cors);
      }catch(cause){
        console.error(cause);
        return new Response(JSON.stringify({error:'Internal server error'}),{
          status:500,
          headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...cors}
        });
      }
    }
    if(request.method==='OPTIONS'){
      return new Response(null,{status:204,headers:cors});
    }
    if(request.headers.get('Origin')&&!origin){
      return new Response(JSON.stringify({error:'Origin not allowed'}),{
        status:403,
        headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...cors}
      });
    }
    try{
      const brandAsset=await handleBrandAssetRoute(request,env,cors);if(brandAsset)return brandAsset;
      const ai=await handleAiRoute(request,env,cors);if(ai)return ai;
      const copilot=await handleCopilotRoute(request,env,cors);if(copilot)return copilot;
      const scrapling=await handleScraplingRoute(request,env,cors);if(scrapling)return scrapling;
      const service=await handleServiceIntegrationRoute(request,env,cors);if(service)return service;
      const sources=await handleIntelligenceSourceRoute(request,env,cors);if(sources)return sources;
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
      runDueSourceHealthChecks(env,now),
      outreachCycle
    ]));
  }
};
