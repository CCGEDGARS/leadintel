'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const A=require('../approved-reference-scripts.js'),E=require('../message-editor.js'),S=require('../message-studio.js'),T=require('../message-translations.js');
const essentials={sender:'Alex Lane',company:'SellerCo',offer:'manufacturing',value:'simplify delivery',difference:'Our team has manufacturing experience.',approach:'We support installation.',meetingValue:'project data',calendly:'https://calendly.com/alex/intro',language:'en'};
const context={channel:'email',buyerCompany:'BuyerCo',buyerName:'Robin',firstName:'Robin',trigger:{summary:'BuyerCo’s plant expansion',url:'https://buyer.test/news',verification:'source_verified'}};
test('all approved master paragraphs and subjects retain the exact recorded text',()=>{
 assert.deepEqual(A.records,require('./fixtures/approved-core-masters-2026-10-09.json'));
});
test('each core contract publishes its own immutable sequence and measured body ceiling',()=>{
 for(const [style,counts] of Object.entries({professional:[12,185],curiosity:[13,219],friendly:[11,200],brutal:[12,199]})){
  const c=A.coreContract(style);assert.equal(c.paragraphRoles.length,counts[0]);assert.equal(c.maximumMessageWords,counts[1]);
  assert.equal(c.paragraphSeparator,'\n\n');assert.equal(c.meetingMinutes,20);assert.equal(c.aiAuthority,'designated-fields-only');
  assert.ok(Object.isFrozen(c));assert.ok(Object.isFrozen(c.paragraphRoles));assert.throws(()=>{c.paragraphRoles.reverse();});
 }
 assert.equal(A.coreContract('original'),null);assert.equal(A.coreContract('template-1'),null);
});
test('field preparation carries the contract and accepts exactly six string fields',()=>{
 const studio=S.normalize({mode:'professional',essentials});const p=E.preparationPrompt(studio,context),payload=JSON.parse(p.prompt);
 assert.deepEqual(payload.coreContract,A.coreContract('professional'));assert.match(p.system,/Do not change literal wording, punctuation, paragraph order or spacing/);
 const fields={triggerSummary:context.trigger.summary,offer:essentials.offer,difference:essentials.difference,value:'',approach:'',meetingValue:''};
 assert.doesNotThrow(()=>E.parsePrepared(fields,studio,context));
 for(const key of Object.keys(fields)){const missing={...fields};delete missing[key];assert.throws(()=>E.preparedResponse(missing,studio,context),/exactly six string fields/);assert.throws(()=>E.parsePrepared(missing,studio,context),/exactly six string fields/);assert.throws(()=>E.parsePrepared({...fields,[key]:null},studio,context),/exactly six string fields/);}
 assert.throws(()=>E.preparedResponse({...fields,message:'Changed master'},studio,context),/unapproved field/);
});
test('explicit rewrite has alternative-only authority and cannot redefine a core master',()=>{
 const p=E.rewritePrompt(S.normalize({mode:'friendly',essentials}),context,{source:{subject:'Hello',message:'Working text'},attempt:1,avoid:[]});
 assert.match(p.system,/never becomes an approved core template/);assert.equal(JSON.parse(p.prompt).operation,'explicit-rewrite-preview');
});
test('translation preserves paragraph boundaries and signature line breaks',()=>{
 const source={subject:'Acme',message:'Hi Sam,\n\nAcme invested 20 EUR.\n\nBook: https://calendly.com/alex/call\n\nRegards,\nAlex'};
 const translated={subject:'Acme',message:'Sveiki, Sam,\n\nAcme ieguldīja 20 EUR.\n\nRezervēt: https://calendly.com/alex/call\n\nAr cieņu,\nAlex'};
 assert.doesNotThrow(()=>T.validate(source,translated,{protectedTerms:['Sam','Acme','Alex']}));
 for(const message of [translated.message.replaceAll('\n\n','\n'),translated.message.replace('Ar cieņu,\nAlex','Ar cieņu, Alex'),translated.message.replace('20 EUR.','20 EUR.\n\nPapildu teksts.')])assert.throws(()=>T.validate(source,{...translated,message}),/paragraph structure/);
 assert.match(T.prompt(source,'lv').system,/Preserve paragraph order/);
});
test('translation cannot move protected facts and links between paragraphs',()=>{
 const input={subject:'',message:'Acme invested 20 EUR.\n\nBeta invested 50 EUR.\n\nBook https://calendly.com/alex/call'};
 for(const message of ['Acme invested 50 EUR.\n\nBeta invested 20 EUR.\n\nBook https://calendly.com/alex/call','Beta invested 20 EUR.\n\nAcme invested 50 EUR.\n\nBook https://calendly.com/alex/call','Acme invested 20 EUR. https://calendly.com/alex/call\n\nBeta invested 50 EUR.\n\nBook'])assert.throws(()=>T.validate(input,{subject:'',message},{protectedTerms:['Acme','Beta']}),/paragraph/);
});
