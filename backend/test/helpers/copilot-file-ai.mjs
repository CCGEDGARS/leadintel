import {runtime,extraction,uploadRequest} from './copilot-runtime.mjs';
import {handleCopilotFileRoute} from '../../src/copilot-file-routes.js';
import {encryptSecret,importAesKey} from '../../src/oauth.js';

export const canonical=()=>({title:'Review',executive_summary:'Useful facts',sections:[{heading:'Evidence',content:'Useful facts',tables:[[['Metric','Value'],['Facts','12']]],evidence:[{locator:'page:1',label:'Page 1'}]}],findings:['Facts found'],recommendations:['Review facts'],risks:[],assumptions:[],data_gaps:[],warnings:[]});
export async function fixture({outputs=[canonical()],document=extraction()}={}){
  const env=runtime();env.OAUTH_TOKEN_ENCRYPTION_KEY=Buffer.alloc(32,7).toString('base64');
  env.DB.sqlite.exec('CREATE TABLE workspace_ai_integrations(workspace_id TEXT,provider TEXT,encrypted_api_key TEXT,model TEXT,active INTEGER)');
  const encrypted=await encryptSecret('fixture-secret',await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY));
  env.DB.sqlite.prepare('INSERT INTO workspace_ai_integrations VALUES(?,?,?,?,?)').run('w1','openai',encrypted,'fixture-model',1);
  const uploaded=await (await handleCopilotFileRoute(uploadRequest({document}),env)).json();
  const file=env.DB.sqlite.prepare('SELECT * FROM copilot_files WHERE id=?').get(uploaded.file_id);
  const calls=[];
  env.COPILOT_FETCH_IMPL=async(url,init)=>{
    calls.push({url,init,body:JSON.parse(init.body)});
    const output=outputs[Math.min(calls.length-1,outputs.length-1)];
    if(typeof output==='function')return output(url,init);
    return new Response(JSON.stringify({output_text:typeof output==='string'?output:JSON.stringify(output),usage:{input_tokens:10,output_tokens:20}}),{headers:{'content-type':'application/json'}});
  };
  return {env,file,extraction:document,calls,options:{workspaceId:'w1',userId:'u1',file,extraction:document,request:'Summarize facts'}};
}
export function analysisRequest(path='file-analyses',{workspace='w1',token='good',body={}}={}){
  return new Request(`https://leadintel.test/api/copilot/${path}?workspace_id=${workspace}`,{method:'POST',headers:{Cookie:`leadintel_session=${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
}
