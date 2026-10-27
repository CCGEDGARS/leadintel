import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const source=fs.readFileSync(new URL('../copilot-ui.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function mount(){
 const dom=new JSDOM('<button id="leadintel-copilot-entry"></button>');const prior={window:globalThis.window,document:globalThis.document};globalThis.window=dom.window;globalThis.document=dom.window.document;
 const w=dom.window;w.LeadIntelServerBridge={workspace:{id:'w1'},session:{user:{id:'u1'}}};w.LeadIntelWorkspacePersistence={isExplicitlySaved:()=>true,hasUnsavedChanges:()=>false};
 const rows=[{id:'a',title:'Open chat'},{id:'b',title:'Old chat'}],calls=[];let answer=true,failure=false,waitConfirm=null;
 w.LeadIntelDialogs={confirm:async()=>waitConfirm?waitConfirm():answer};
 const api={bootstrapCopilot:async()=>({role:'owner',ai:{configured:true},latestConversation:rows[0]||null,memories:[{id:'memory',kind:'preference',value:'Remember me'}]}),listCopilotConversations:async()=>({conversations:[...rows],canDelete:true}),getCopilotConversation:async id=>({conversation:{id,title:id},messages:[{role:'user',content:'Question '+id},{role:'assistant',content:'Answer '+id}]}),deleteCopilotConversation:async id=>{calls.push(id);if(failure)throw new Error('Deletion failed');const i=rows.findIndex(r=>r.id===id);if(i>=0)rows.splice(i,1);return {deleted:1};},clearCopilotHistory:async()=>{calls.push('all');if(failure)throw new Error('Deletion failed');rows.splice(0);return {deleted:2};},sendCopilotMessage:async payload=>{calls.push(payload);return {conversation_id:payload.conversation_id||'new',answer:'Done'};}};
 const mod=await import(`data:text/javascript;base64,${Buffer.from(source+'\n//deletion-'+Math.random()).toString('base64')}`);const panel=await mod.openCopilot({api,context:{currentCopilotScreenContext:()=>({step:6})}});await tick();
 return {dom,w,panel,rows,calls,mod,api,setAnswer:v=>answer=v,setFailure:v=>failure=v,setConfirm:v=>waitConfirm=v,async history(){panel.querySelector('[data-copilot-action="history"]').click();await tick();},restore(){dom.window.close();Object.assign(globalThis,prior);}};
}
test('cancel preserves chats; deleting the open chat resets composer context and preserves memories after reopen',async()=>{
 const m=await mount();try{await m.history();let del=m.panel.querySelector('[data-copilot-delete="a"]');assert.ok(del,'each history row has a delete button');
 m.setAnswer(false);del.click();await tick();assert.deepEqual(m.calls,[]);assert.equal(m.rows.length,2);
 m.setAnswer(true);del.click();await tick();assert.deepEqual(m.calls,['a']);assert.equal(m.panel.querySelectorAll('.copilot-message').length,0);assert.match(m.panel.querySelector('[data-copilot-action="memories"]').textContent,/1/);
 assert.equal(m.panel.querySelector('[data-copilot-delete="a"]'),null);
 m.panel.querySelector('textarea').value='Fresh question';m.panel.querySelector('form').dispatchEvent(new m.dom.window.Event('submit',{bubbles:true,cancelable:true}));await tick();assert.equal(m.calls.at(-1).conversation_id,undefined);
 await m.mod.openCopilot({api:m.api,context:{currentCopilotScreenContext:()=>({})}});assert.doesNotMatch(m.panel.querySelector('[data-copilot-messages]').textContent,/Question a/);
 }finally{m.restore();}
});
test('clear all requires confirmation, shows empty state and remains empty when reopened',async()=>{
 const m=await mount();try{await m.history();const clear=m.panel.querySelector('[data-copilot-clear-history]');assert.ok(clear);
 m.setAnswer(false);clear.click();await tick();assert.equal(m.rows.length,2);
 m.setAnswer(true);clear.click();await tick();assert.deepEqual(m.calls,['all']);assert.equal(m.rows.length,0);assert.match(m.panel.querySelector('.copilot-history-list').textContent,/No saved conversations/);assert.equal(m.panel.querySelectorAll('.copilot-message').length,0);assert.equal(clear.disabled,true);
 await m.mod.openCopilot({api:m.api,context:{currentCopilotScreenContext:()=>({})}});assert.equal(m.panel.querySelectorAll('.copilot-message').length,0);assert.match(m.panel.querySelector('[data-copilot-action="memories"]').textContent,/1/);
 }finally{m.restore();}
});
test('failed deletion preserves history and gives a visible retryable error',async()=>{
 const m=await mount();try{await m.history();m.setFailure(true);m.panel.querySelector('[data-copilot-delete="b"]').click();await tick();assert.equal(m.rows.length,2);assert.equal(m.panel.querySelectorAll('.copilot-message').length,2);assert.match(m.panel.querySelector('[data-copilot-history-status]').textContent,/Deletion failed/);assert.equal(m.panel.querySelector('[data-copilot-delete="b"]').disabled,false);
 }finally{m.restore();}
});
test('a workspace switch during confirmation cancels the deletion',async()=>{
 const m=await mount();try{await m.history();let finish;m.setConfirm(()=>new Promise(resolve=>finish=resolve));m.panel.querySelector('[data-copilot-delete="a"]').click();await tick();m.w.LeadIntelServerBridge.workspace.id='w2';finish(true);await tick();assert.deepEqual(m.calls,[]);assert.equal(m.rows.length,2);
 }finally{m.restore();}
});
test('delayed conversation reads cannot bring a deleted chat back',async()=>{
 const m=await mount();try{await m.history();const original=m.api.getCopilotConversation;let finish;m.api.getCopilotConversation=id=>new Promise(resolve=>finish=()=>original(id).then(resolve));m.panel.querySelector('[data-copilot-conversation-id="b"]').click();await tick();await m.history();m.panel.querySelector('[data-copilot-delete="b"]').click();await tick();finish();await tick();assert.match(m.panel.querySelector('[data-copilot-messages]').textContent,/Question a/);assert.doesNotMatch(m.panel.querySelector('[data-copilot-messages]').textContent,/Question b/);
 }finally{m.restore();}
});
test('deletion is disabled while an answer is still being saved',async()=>{
 const m=await mount();try{let finish;m.api.sendCopilotMessage=()=>new Promise(resolve=>finish=resolve);m.panel.querySelector('textarea').value='Next';m.panel.querySelector('form').dispatchEvent(new m.dom.window.Event('submit',{bubbles:true,cancelable:true}));await tick();await m.history();assert.equal(m.panel.querySelector('[data-copilot-delete="a"]').disabled,true);assert.equal(m.panel.querySelector('[data-copilot-clear-history]').disabled,true);finish({conversation_id:'a',answer:'Saved'});await tick();assert.deepEqual(m.calls,[]);
 }finally{m.restore();}
});
