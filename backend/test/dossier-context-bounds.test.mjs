import {test} from 'node:test';import assert from 'node:assert/strict';import {handleAiRoute} from '../src/ai-routes.js';
function env(){return {DB:{prepare(sql){return {bind(){return this},async first(){if(sql.includes('JOIN users'))return {id:'u'};if(sql.includes('workspace_members'))return {role:'owner'};return null},async all(){return {results:[]}},async run(){return {meta:{changes:1}}}}}}};}
function request(formulas){return new Request('https://example.com/api/ai/company-dossier?workspace_id=w',{method:'POST',headers:{Cookie:'leadintel_session=test','Content-Type':'application/json'},body:JSON.stringify({company:'Northwind',domain:'northwind.example',formulas})});}
test('all thirty supported full-length formulas pass route bounds before missing-provider response',async()=>{
 const response=await handleAiRoute(request(Array.from({length:30},(_,i)=>String(i).padStart(2,'0')+'q'.repeat(1998))),env());assert.equal(response.status,409);assert.match((await response.json()).error,/researcher|provider/i);
});
test('invalid formula count or type rejects before accessing provider credentials',async()=>{
 for(const formulas of [Array(31).fill('query'),[{}],['q'.repeat(2001)],'query']){const response=await handleAiRoute(request(formulas),env());assert.equal(response.status,400);assert.match((await response.json()).error,/formula/i);}
});
