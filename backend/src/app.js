import {enrollConversationWorkflows} from './conversation-workflows.js';
import {handleLanguagePackRoute} from './language-pack-routes.js';
import {runLanguagePackJobs} from './language-packs.js';
import {handleGoogleTranslationRoute} from './google-translation-routes.js';
import {handleMicrosoftCalendarRoute} from './microsoft-calendar.js';
import {handleGoogleCalendarRoute} from './google-calendar.js';
import {handleScriptLibraryRoute} from './script-library-routes.js';
import {handleWritingWorkspaceRoute} from './writing-workspace-routes.js';
import {handleEmailCampaignRoute} from './email-campaign-routes.js';
import {storageErrorResponse} from './workspace-storage.js';
import {withWorkspaceStorage,reconcileStorageObjects} from './workspace-storage-objects.js';
import {handleStorageRoute,handleStorageWebhook} from './workspace-storage-billing.js';
import {handleSavedFlowRoute} from './saved-flow-routes.js';
import {runSavedFlows} from './saved-flow-runner.js';
import {handleApprovedWorkflowRoute} from './approved-workflow-routes.js';
import {runApprovedWorkflows} from './approved-workflow-runner.js';
import core from './index.js';
import {allowedOrigin,corsHeaders} from './security.js';
import {handleAiRoute} from './ai-routes.js';
import {handleServiceIntegrationRoute,withWorkspaceServiceCredentials} from './service-integrations.js';
import {handleAdditionalContactRoute} from './additional-contact-services.js';
import {handleScraplingRoute} from './scrapling-routes.js';
import {handleSaasRoute} from './saas-routes.js';
import {handleOutreachAutomationRoute} from './outreach-automation-routes.js';
import {runOutreachAutomation} from './outreach-automation-runner.js';
import {pollOutreachReplies} from './outreach-automation-replies.js';
import {handleConversationRoute,pollConversations,runConversationPlans} from './conversations.js';
import {handleCrmRoute} from './crm-routes.js';
import {handleResearchCostsRoute} from './research-costs.js';
import {handleApolloCrmWebhook} from './crm-routes.js';
import {handleMarketMonitoringRoute,runDueMarketMonitoring} from './market-monitoring.js';
import {handleIntelligenceSourceRoute,runDueSourceHealthChecks} from './intelligence-sources.js';
import {handleCopilotRoute} from './copilot-routes.js';
import {handleBrandAssetRoute} from './brand-assets.js';
import {handleCalendlyWebhook,handleCalendlyIntegrationRoute} from './calendly-integration.js';
import {handleContentMaterialsRoute} from './content-materials.js';
import {handleWritingReferenceRoute} from './writing-reference-routes.js';
import {handleWorkspaceSkillRoute} from './workspace-skill-routes.js';
import {runWorkspaceSkillJobs} from './workspace-skill-runner.js';
import {runWritingReferenceJobs} from './writing-reference-runner.js';
import {withBookInvocationBudget} from './book-invocation-budget.js';
import {handleStoryBankRoute} from './storyselling.js';
import {handleCompanyMaterialsRoute} from './company-materials.js';
import {runCompanyMaterialJobs} from './company-materials-analysis.js';
import {handleAccessRoute} from './access-invitations.js';
import {observeScheduledTask} from './operational-observability.js';

const scheduledJobs={reconcileStorageObjects,runWritingReferenceJobs,runWorkspaceSkillJobs,runCompanyMaterialJobs,runLanguagePackJobs,runSavedFlows,runApprovedWorkflows,pollConversations,enrollConversationWorkflows,runConversationPlans,pollOutreachReplies,runOutreachAutomation,runDueMarketMonitoring,runDueSourceHealthChecks};

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname==='/api/webhooks/stripe/storage')return handleStorageWebhook(request,env);
    env=withWorkspaceStorage(env);
    if(url.pathname.startsWith('/api/webhooks/calendly/')){
      try{return await handleCalendlyWebhook(request,env);}catch(cause){console.error(cause);return new Response(JSON.stringify({error:'Internal server error'}),{status:500,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});}
    }
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
      const languagePack=await handleLanguagePackRoute(request,env,cors,ctx);if(languagePack)return languagePack;
      const translation=await handleGoogleTranslationRoute(request,env,cors);if(translation)return translation;
      const microsoftCalendar=await handleMicrosoftCalendarRoute(request,env,cors);if(microsoftCalendar)return microsoftCalendar;
      const calendar=await handleGoogleCalendarRoute(request,env,cors);if(calendar)return calendar;
      const researchCosts=await handleResearchCostsRoute(request,env,cors);if(researchCosts)return researchCosts;
      const access=await handleAccessRoute(request,env,cors);if(access)return access;
      const scripts=await handleScriptLibraryRoute(request,env,cors);if(scripts)return scripts;
      const writingWorkspace=await handleWritingWorkspaceRoute(request,env,cors);if(writingWorkspace)return writingWorkspace;
      const storage=await handleStorageRoute(request,env,cors);if(storage)return storage;
      const campaigns=await handleEmailCampaignRoute(request,env,cors);if(campaigns)return campaigns;
      const flows=await handleSavedFlowRoute(request,env,cors);if(flows)return flows;
      const storyBank=await handleStoryBankRoute(request,env,cors);if(storyBank)return storyBank;
      const companyMaterials=await handleCompanyMaterialsRoute(request,env,cors);if(companyMaterials)return companyMaterials;
      const materials=await handleContentMaterialsRoute(request,env,cors);if(materials)return materials;
      const skills=await handleWorkspaceSkillRoute(request,env,cors);if(skills)return skills;
      const writing=await handleWritingReferenceRoute(request,env,cors,ctx);if(writing)return writing;
      const brandAsset=await handleBrandAssetRoute(request,env,cors);if(brandAsset)return brandAsset;
      const ai=await handleAiRoute(request,env,cors);if(ai)return ai;
      const copilot=await handleCopilotRoute(request,env,cors);if(copilot)return copilot;
      const scrapling=await handleScraplingRoute(request,env,cors);if(scrapling)return scrapling;
      const additionalContacts=await handleAdditionalContactRoute(request,env,cors);if(additionalContacts)return additionalContacts;
      const service=await handleServiceIntegrationRoute(request,env,cors);if(service)return service;
      const calendly=await handleCalendlyIntegrationRoute(request,env,cors);if(calendly)return calendly;
      const sources=await handleIntelligenceSourceRoute(request,env,cors);if(sources)return sources;
      const monitoring=await handleMarketMonitoringRoute(request,env,cors);if(monitoring)return monitoring;
      const workflow=await handleApprovedWorkflowRoute(request,env,cors);if(workflow)return workflow;
      const runtimeEnv=await withWorkspaceServiceCredentials(request,env);
      const conversations=await handleConversationRoute(request,runtimeEnv,cors);if(conversations)return conversations;
      const crm=await handleCrmRoute(request,runtimeEnv,cors);if(crm)return crm;
      const automation=await handleOutreachAutomationRoute(request,runtimeEnv,cors);if(automation)return automation;
      const saas=await handleSaasRoute(request,runtimeEnv,cors);if(saas)return saas;
      return core.fetch(request,runtimeEnv);
    }catch(cause){
      const storageError=storageErrorResponse(cause,cors);if(storageError)return storageError;console.error(cause);return new Response(JSON.stringify({error:'Internal server error'}),{status:500,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...cors}});
    }
  },
  async scheduled(controller,env,ctx,jobs=scheduledJobs){
    const now=new Date(controller.scheduledTime||Date.now());
    if(controller.cron==='* * * * *')env=withBookInvocationBudget(env);
    const storageEnv=env;env=withWorkspaceStorage(env);
    const observed=(task,operation)=>observeScheduledTask(env,task,operation,{scheduledAt:now.getTime()});
    if(storageEnv.WORKSPACE_STORAGE_ENABLED==='true')ctx.waitUntil(observeScheduledTask(storageEnv,'storage_reconciliation',()=>jobs.reconcileStorageObjects(storageEnv),{scheduledAt:now.getTime()}).catch(()=>console.warn('Workspace file accounting needs a retry')));
    if(controller.cron==='* * * * *'){ctx.waitUntil(Promise.allSettled([observed('writing_references',()=>jobs.runWritingReferenceJobs(env,{now:now.getTime()})),observed('workspace_skills',()=>jobs.runWorkspaceSkillJobs(env,{now:now.getTime()})),observed('company_materials',()=>jobs.runCompanyMaterialJobs(env,{now:now.getTime()})),observed('language_packs',()=>jobs.runLanguagePackJobs(env,{now:now.getTime()}))]));return;}
    const outreachCycle=observed('saved_flows',()=>jobs.runSavedFlows(env,{now})).then(()=>observed('approved_workflows',()=>jobs.runApprovedWorkflows(env,{now}))).catch(cause=>console.error('Approved workflow cycle failed',cause)).then(()=>observed('conversation_poll',()=>jobs.pollConversations(env,{now}))).then(()=>observed('conversation_enrollment',()=>jobs.enrollConversationWorkflows(env,{now})).catch(cause=>console.error('Conversation workflow enrollment cycle failed',cause))).then(()=>observed('conversation_plans',()=>jobs.runConversationPlans(env,{now}))).then(()=>observed('outreach_replies',()=>jobs.pollOutreachReplies(env,{now})).then(()=>observed('outreach_delivery',()=>jobs.runOutreachAutomation(env,{now}))));
    ctx.waitUntil(Promise.allSettled([
      observed('market_monitoring',()=>jobs.runDueMarketMonitoring(env,now)),
      observed('source_health',()=>jobs.runDueSourceHealthChecks(env,now)),
      outreachCycle
    ]));
  }
};
