const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const settle=()=>new Promise(r=>setTimeout(r,40));
async function mounted({catalog=['claude-opus-5-5','claude-sonnet-5-5','claude-haiku-5-5'],fail=false}={}){
 const w=new JSDOM('<div class="top-actions"></div><div id="toast"></div>',{url:'https://example.test/customer/',runScripts:'outside-only'}).window;
 w.LeadIntelServerBridge={session:{authenticated:true,user:{email:'user@example.com'}},authProvider:'google',workspace:{id:'w1',role:'owner'}};
 w.LeadIntelSenderIdentity={get:()=>({meetingPlatform:'zoom'}),setMeetingPlatform(){}};
 const calls=[];
 w.fetch=async(url,options={})=>{const route=new URL(String(url)).pathname;calls.push({route,method:options.method||'GET',body:options.body?JSON.parse(options.body):null});
  if(route.endsWith('/ai/models'))return fail?{ok:false,json:async()=>({error:'nope'})}:{ok:true,json:async()=>({provider:'anthropic',recommended:'claude-sonnet-5-5',models:catalog})};
  if(route.endsWith('/ai/status'))return {ok:true,json:async()=>({role:'owner',providers:[{provider:'anthropic',name:'Anthropic',configured:true,active:true,model:'claude-opus-5-5',verified_at:'2026-10-25T10:00:00Z'}]})};
  return {ok:true,json:async()=>({role:'owner',providers:[]})};};
 w.eval(read('personal-linkedin.js'));w.eval(read('tool-account-links.js'));w.eval(read('ai-settings.js').replace(/^import .*;\s*$/gm,''));
 w.document.getElementById('open-settings').click();await settle();await settle();return {w,calls};
}
test('a verified key loads the provider catalogue once; the saved model is selected from it and the recommended/custom options remain',async()=>{
 const {w,calls}=await mounted();try{
  const select=w.document.querySelector('[data-ai-model-mode="anthropic"]');assert.ok(select);
  const values=[...select.options].map(o=>o.value);
  assert.deepEqual(values,['recommended','model:claude-opus-5-5','model:claude-haiku-5-5','advanced']);
  assert.equal(select.value,'model:claude-opus-5-5','the saved model is selected from the catalogue');
  assert.equal(calls.filter(c=>c.route.endsWith('/ai/models')).length,1,'catalogue requested once per provider');
  assert.deepEqual(calls.find(c=>c.route.endsWith('/ai/models')).body,{provider:'anthropic'});
  assert.match(w.document.querySelector('[data-ai-model-catalog="anthropic"]').textContent,/3 models available on this key/);
  assert.equal(w.document.querySelector('[data-ai-model-mode="openai"]').options.length,2,'unconfigured providers keep recommended + custom');
 }finally{w.close();}
});
test('when the provider cannot list models the card falls back to recommended + custom without an error state',async()=>{
 const {w}=await mounted({fail:true});try{
  const select=w.document.querySelector('[data-ai-model-mode="anthropic"]');
  assert.deepEqual([...select.options].map(o=>o.value),['recommended','advanced']);
  assert.equal(select.value,'advanced','a saved model outside the recommended one is shown as custom');
  assert.equal(w.document.querySelector('[data-ai-model="anthropic"]').value,'claude-opus-5-5');
 }finally{w.close();}
});
