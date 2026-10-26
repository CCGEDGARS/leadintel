import test from 'node:test';
import assert from 'node:assert/strict';
import {storageFixture} from './writing-reference-fixture.mjs';
import {readFileSync} from 'node:fs';
const api=await import('../src/company-materials-context.js').catch(()=>({}));
const analysis={summary:'Workshop for production managers',customer:'Steelworks',industry:'manufacturing',challenge:'',solution:'sales training',outcome:'',evidence:[{location:'page:1',quote:'Steelworks manufacturing managers attended sales training and rated the practical workshop 9 out of 10.'}]};
async function fixture(){const env=storageFixture();env.DB.raw.exec(readFileSync(new URL('../migrations/0052_company_materials.sql',import.meta.url),'utf8'));for(const [id,workspace,a] of [['a','w1',analysis],['b','w2',{...analysis,customer:'Foreign'}]])await env.DB.prepare("INSERT INTO company_materials(id,workspace_id,filename,mime,kind,byte_size,digest,original_key,text_key,status,analysis_json) VALUES(?,?,?,'application/pdf','pdf',1,?,?,?,'Ready',?)").bind(id,workspace,id+'.pdf',id,id+'/original',id+'/text',JSON.stringify(a)).run();return env;}
test('automatic source retrieval exists',()=>assert.equal(typeof api.selectCompanyMaterials,'function'));
test('selects relevant Ready evidence only from this workspace; irrelevant and general contexts stay empty',async()=>{
 const env=await fixture(),selected=await api.selectCompanyMaterials(env,'w1','manufacturing sales training');assert.equal(selected.length,1);assert.equal(selected[0].filename,'a.pdf');assert.equal(selected[0].evidence.length,1);
 assert.deepEqual(await api.selectCompanyMaterials(env,'w1','marine archaeology'),[]);
 assert.deepEqual((await api.prepareCompanyMaterialGeneration(env,'w1',{task:'core-fields',writing_mode:'professional',prompt:'manufacturing'})).refs,[]);
 assert.deepEqual((await api.prepareCompanyMaterialGeneration(env,'w1',{task:'outreach-generation',writing_mode:'professional',prompt:'manufacturing'})).refs,[]);
 const result=await api.prepareCompanyMaterialGeneration(env,'w1',{task:'outreach-generation',writing_mode:'original',prompt:'manufacturing sales training',system:'Keep identities'});assert.equal(result.refs.length,1);assert.match(result.system,/user-provided/);assert.match(result.system,/never.*buyer/i);assert.match(result.prompt,/Steelworks/);
 await env.DB.prepare("UPDATE company_materials SET status='Needs attention' WHERE id='a'").run();assert.deepEqual(await api.selectCompanyMaterials(env,'w1','manufacturing'),[]);
});
test('a source removed or revised during generation invalidates the result',async()=>{const env=await fixture(),refs=await api.selectCompanyMaterials(env,'w1','manufacturing');await api.assertCompanyMaterialsCurrent(env,'w1',refs);await env.DB.prepare("DELETE FROM company_materials WHERE id='a'").run();await assert.rejects(api.assertCompanyMaterialsCurrent(env,'w1',refs),/changed|removed/);});
import {prepareAssistantRequest,validateAssistantReply} from '../src/writing-assistant.js';
test('Writing Assistant gets automatic company proof with separate citation provenance and validates documented quantities',async()=>{
 const env=await fixture(),context={channel:'email',style:'professional',recipient:{name:'Alice',industry:'manufacturing'},seller:{sender:'Bob'},currentDraft:{subject:'Hello',message:'Hi Alice, Bob here.'}};
 const prepared=await prepareAssistantRequest(env,{workspaceId:'w1'},{instruction:'Write a storyselling message about manufacturing sales training',context,sourceRefs:[]});assert.equal(prepared.companyMaterials.length,1);assert.match(prepared.prompt,/companyReferenceEvidence/);
 const passageId=prepared.companyMaterials[0].evidence[0].passageId,result={reply:'Used the workshop reference.',draft:{subject:'Practical training',message:'Hi Alice, Bob here. Steelworks rated the practical sales training workshop 9 out of 10.'},citations:[],materialCitations:[{passageId}],warnings:[]};
 const validated=validateAssistantReply(JSON.stringify(result),prepared);assert.equal(validated.provenance.companyMaterialRefs[0].filename,'a.pdf');assert.match(validated.warnings.join(' '),/Reference used: a.pdf/);
 assert.throws(()=>validateAssistantReply(JSON.stringify({...result,draft:{...result.draft,message:result.draft.message+' Revenue grew 37%.'}}),prepared),/unsupported number/);
 const general=await prepareAssistantRequest(env,{workspaceId:'w1'},{instruction:'Write about manufacturing',context:{writingContext:'general',currentDraft:{message:''}},sourceRefs:[]});assert.deepEqual(general.companyMaterials,[]);
});
test('translated analysis metadata can retrieve a Latvian reference for English writing without becoming factual evidence',async()=>{
 const env=await fixture();await env.DB.prepare("UPDATE company_materials SET analysis_json=? WHERE id='a'").bind(JSON.stringify({...analysis,summary:'Sales training for manufacturing managers',evidence:[{location:'page:1',quote:'Ļoti vērtīgas pārdošanas apmācības ražošanas uzņēmuma vadītājiem.'}]})).run();
 const selected=await api.selectCompanyMaterials(env,'w1','manufacturing sales training');assert.equal(selected.length,1);assert.match(selected[0].evidence[0].quote,/pārdošanas/);assert.ok(!selected[0].summary);
});
