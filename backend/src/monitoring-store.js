import Model from '../../customer/monitoring-model.js';
import {normalizeMonitoringConfig} from './market-monitoring-engine.js';
import {sha256} from './security.js';
import {messageRowAssertion} from './message-operation-authority.js';
export const parse=(s,f={})=>{try{return JSON.parse(s||'')??f;}catch{return f;}};
export const monitorScope=(row)=>row?.id&&row.id!=='legacy'?{table:'monitoring_monitors',where:'workspace_id=? AND id=?',args:[row.workspace_id,row.id],id:row.id}:{table:'market_monitoring_configs',where:'workspace_id=?',args:[row?.workspace_id],id:'legacy'};
export function monitorConfig(row){return {...normalizeMonitoringConfig(row?{enabled:!!row.enabled,frequency:row.frequency,research_depth:row.research_depth,minimum_score:row.minimum_score,source_types:parse(row.source_types_json,[]),signal_ids:parse(row.signal_ids_json,[]),custom_sources:parse(row.custom_sources_json,[]),workflow:parse(row.workflow_json)}:{}),id:row?.id||'legacy',name:row?.name||'Existing monitor',categoryId:row?.category_id||'',archived:!!row?.archived,revision:row?.revision||0,nextRunAt:row?.next_run_at||'',lastRunAt:row?.last_run_at||'',updatedAt:row?.updated_at||'',previewId:row?.preview_id||''};}
export async function readMonitor(env,workspaceId,id='legacy'){return id==='legacy'?env.DB.prepare('SELECT * FROM market_monitoring_configs WHERE workspace_id=?').bind(workspaceId).first():env.DB.prepare('SELECT * FROM monitoring_monitors WHERE workspace_id=? AND id=?').bind(workspaceId,id).first();}
export async function categoryAuthority(env,workspaceId,workflow){
 if(!workflow?.categoryId)return null;
 const category=await env.DB.prepare('SELECT * FROM monitoring_categories WHERE workspace_id=? AND id=?').bind(workspaceId,workflow.categoryId).first();
 if(!category||category.archived||category.definition_hash!==workflow.categoryDefinitionHash||category.purpose!==workflow.purpose)throw Object.assign(Error('Category changed or was archived. Review its criteria and test the monitor again.'),{status:409,code:'monitoring_category_changed'});
 return category;
}
export const categoryAssertion=(env,c)=>messageRowAssertion(env.DB,'monitoring_categories','workspace_id=? AND id=?',[c.workspace_id,c.id],{definition_hash:c.definition_hash,archived:0});
export async function resolveWorkflow(env,workspaceId,input={}){
 let workflow=Model.normalizeWorkflow(input),category=null;
 if(workflow.categoryId){category=await env.DB.prepare('SELECT * FROM monitoring_categories WHERE workspace_id=? AND id=?').bind(workspaceId,workflow.categoryId).first();if(!category||category.archived)throw Object.assign(Error('Choose an available category.'),{status:409});const criteria=parse(category.criteria_json);workflow=Model.normalizeWorkflow({...workflow,purpose:category.purpose,queryTerms:criteria.queryTerms,excludeTerms:criteria.excludeTerms,categoryDefinitionHash:category.definition_hash});}
 return {workflow,category};
}
export async function researchHash(config){return sha256(JSON.stringify({sources:config.customSources,sourceTypes:config.sourceTypes,signalIds:config.signalIds,depth:config.researchDepth,score:config.minimumScore,workflow:Object.fromEntries(['purpose','readMode','queryTerms','excludeTerms','categoryId','categoryDefinitionHash'].map(k=>[k,config.workflow[k]??null]))}));}
