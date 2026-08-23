const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeEmail,buildGmailComposeUrl,confirmSend,classifyReply,recordReply,recordOutcome,recommendedPipelineStage,buildLearningSummary,normalizeDeliveryState
}=require('../delivery-engine.js');

const approvedPackage={
  domain:'example.com',company:'Example Manufacturing',approved:true,approvedAt:'2026-08-23T08:00:00.000Z',
  drafts:{tone:'consultative',emailSubject:'Capacity expansion',emailBody:'Hello Anna,\n\nI noticed your expansion programme. Would it be useful to compare options?\n\nBest,'},
  dossier:{recommendedOffer:'Industrial engineering',market:'Sweden',matchedSignals:[{name:'Expansion'}]}
};

function emptyState(){return normalizeDeliveryState({});}

test('normalizeEmail accepts normal addresses and rejects unsafe/invalid values',()=>{
  assert.equal(normalizeEmail('  Anna@Example.com '),'anna@example.com');
  assert.equal(normalizeEmail('not-an-email'),'');
  assert.equal(normalizeEmail('a@b'),'');
  assert.equal(normalizeEmail('anna@example.com\nBcc:test@example.com'),'');
});

test('buildGmailComposeUrl requires approved package and encodes approved content',()=>{
  const url=buildGmailComposeUrl(approvedPackage,'anna@example.com');
  assert.match(url,/^https:\/\/mail\.google\.com\/mail\/\?/);
  const parsed=new URL(url);
  assert.equal(parsed.searchParams.get('to'),'anna@example.com');
  assert.equal(parsed.searchParams.get('su'),'Capacity expansion');
  assert.match(parsed.searchParams.get('body'),/noticed your expansion programme/);
  assert.equal(buildGmailComposeUrl({...approvedPackage,approved:false},'anna@example.com'),'');
  assert.equal(buildGmailComposeUrl(approvedPackage,'bad-email'),'');
});

test('confirmSend requires approval and records a connector-neutral send event',()=>{
  const denied=confirmSend(emptyState(),{...approvedPackage,approved:false},'anna@example.com','2026-08-23T09:00:00.000Z');
  assert.equal(denied.error,'Approved outreach package required');
  const next=confirmSend(emptyState(),approvedPackage,'anna@example.com','2026-08-23T09:00:00.000Z');
  assert.equal(next.error,'');
  assert.equal(next.state.opportunities[0].recipientEmail,'anna@example.com');
  assert.equal(next.state.opportunities[0].deliveryChannel,'gmail-compose');
  assert.equal(next.state.opportunities[0].sentAt,'2026-08-23T09:00:00.000Z');
  assert.equal(next.state.activity[0].type,'message.sent');
  assert.equal(recommendedPipelineStage(next.state.opportunities[0]),'Contacted');
});

test('classifyReply is conservative but detects meeting, positive, objection, not-now, referral, unsubscribe and out-of-office',()=>{
  assert.equal(classifyReply('Can we schedule a call next Tuesday at 10?'),'meeting_request');
  assert.equal(classifyReply('Yes, this sounds interesting. Please send more information.'),'positive');
  assert.equal(classifyReply('We already have a supplier and your price is too high.'),'objection');
  assert.equal(classifyReply('Not now, please contact me again next quarter.'),'not_now');
  assert.equal(classifyReply('Please speak with Marta in procurement instead.'),'referral');
  assert.equal(classifyReply('Please unsubscribe me from future emails.'),'unsubscribe');
  assert.equal(classifyReply('I am out of office until September 2.'),'out_of_office');
  assert.equal(classifyReply('Thanks for your email.'),'neutral');
});

test('recordReply advances to Replied or Meeting based on reply intent',()=>{
  let state=confirmSend(emptyState(),approvedPackage,'anna@example.com','2026-08-23T09:00:00.000Z').state;
  let result=recordReply(state,'example.com','Thanks, can we schedule a call on Thursday?','2026-08-23T10:00:00.000Z');
  assert.equal(result.error,'');
  assert.equal(result.record.latestReplyCategory,'meeting_request');
  assert.equal(result.record.replies.length,1);
  assert.equal(recommendedPipelineStage(result.record),'Meeting');

  state=confirmSend(emptyState(),approvedPackage,'anna@example.com','2026-08-23T09:00:00.000Z').state;
  result=recordReply(state,'example.com','Thanks for the information.','2026-08-23T10:00:00.000Z');
  assert.equal(recommendedPipelineStage(result.record),'Replied');
});

test('recordOutcome validates commercial stages and never loses an existing later outcome',()=>{
  let state=confirmSend(emptyState(),approvedPackage,'anna@example.com','2026-08-23T09:00:00.000Z').state;
  let result=recordOutcome(state,'example.com','Proposal','2026-08-24T09:00:00.000Z');
  assert.equal(result.record.outcomeStage,'Proposal');
  result=recordOutcome(result.state,'example.com','Meeting','2026-08-24T10:00:00.000Z');
  assert.equal(result.record.outcomeStage,'Proposal');
  result=recordOutcome(result.state,'example.com','Won','2026-08-25T10:00:00.000Z');
  assert.equal(result.record.outcomeStage,'Won');
  const invalid=recordOutcome(result.state,'example.com','Discovered','2026-08-25T11:00:00.000Z');
  assert.equal(invalid.error,'Invalid outcome stage');
});

test('normalizeDeliveryState caps opportunity records, replies and activity safely',()=>{
  const opportunities=Array.from({length:70},(_,i)=>({domain:`c${i}.com`,company:`C${i}`,recipientEmail:`x${i}@c${i}.com`,sentAt:'2026-08-23T09:00:00.000Z',replies:Array.from({length:30},(__,j)=>({id:`r${j}`,text:'hello',category:'neutral',at:'2026-08-23T10:00:00.000Z'}))}));
  const activity=Array.from({length:250},(_,i)=>({id:`a${i}`,type:'message.sent',domain:'x.com',at:'2026-08-23T09:00:00.000Z'}));
  const state=normalizeDeliveryState({selectedDomain:'c0.com',opportunities,activity});
  assert.equal(state.opportunities.length,50);
  assert.equal(state.opportunities[0].replies.length,20);
  assert.equal(state.activity.length,200);
  assert.equal(state.connector.id,'gmail-compose');
  assert.equal(state.connector.syncMode,'manual-confirmation');
});

test('buildLearningSummary calculates funnel metrics and waits for minimum sample before recommendations',()=>{
  let state=emptyState();
  const outreach=[];const pipeline=[];
  for(let i=0;i<5;i++){
    const pkg={...approvedPackage,domain:`c${i}.com`,company:`C${i}`,drafts:{...approvedPackage.drafts,tone:i<3?'consultative':'direct'},dossier:{...approvedPackage.dossier,market:'Sweden',recommendedOffer:'Industrial engineering',matchedSignals:[{name:'Expansion'}]}};
    state=confirmSend(state,pkg,`buyer${i}@c${i}.com`,`2026-08-23T0${i}:00:00.000Z`).state;
    outreach.push(pkg);
    pipeline.push({domain:pkg.domain,market:'Sweden',matchedSignals:[{name:'Expansion'}],stage:'Contacted'});
    if(i<3)state=recordReply(state,pkg.domain,i<2?'Can we schedule a call?':'Sounds interesting.',`2026-08-24T0${i}:00:00.000Z`).state;
  }
  const summary=buildLearningSummary(state,outreach,pipeline,3);
  assert.equal(summary.metrics.sent,5);
  assert.equal(summary.metrics.replied,3);
  assert.equal(summary.metrics.meetings,2);
  assert.equal(summary.byTone.find(x=>x.key==='consultative').sent,3);
  assert.ok(summary.recommendations.some(x=>/Consultative/i.test(x)));

  const tooSmall=buildLearningSummary(normalizeDeliveryState({opportunities:state.opportunities.slice(0,2),activity:state.activity}),outreach.slice(0,2),pipeline.slice(0,2),3);
  assert.equal(tooSmall.recommendations.length,0);
});
