const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../delivery-engine.js'),{approveMessage}=require('./helpers/approved-message.cjs');
const pkg=(person='alice',approvedAt='2026-10-24T08:00:00Z')=>approveMessage({domain:'buyer.example',company:'Buyer',channel:'email',selectedPersonId:person,approvedAt,approved:true,drafts:{emailSubject:'Hello '+person,emailBody:'Approved email for '+person}},{personId:person,email:person+'@buyer.example',name:person+' Fixture'});
const sent=(state,person='alice',approvedAt)=>D.confirmSend(state,pkg(person,approvedAt),person+'@buyer.example','2026-10-24T09:00:00Z');
test('separate buyers and approvals retain separate sends through save/reload',()=>{
 let state=sent({}).state;state=sent(state,'bob').state;state=sent(state,'alice','2026-10-25T08:00:00Z').state;
 state=D.normalizeDeliveryState(JSON.parse(JSON.stringify(state)));
 assert.equal(state.opportunities.length,3);
 assert.equal(new Set(state.opportunities.map(r=>r.id)).size,3);
 assert.equal(state.opportunities.filter(r=>r.recipientEmail==='alice@buyer.example').length,2);
 assert.equal(D.findDeliveryRecord(state,pkg('bob'),'bob@buyer.example').recipientEmail,'bob@buyer.example');
});
test('confirming the same approved send twice preserves the original timestamp and activity',()=>{
 const first=sent({});const second=D.confirmSend(first.state,pkg(),'alice@buyer.example','2026-10-25T09:00:00Z');
 assert.equal(second.record.sentAt,'2026-10-24T09:00:00.000Z');assert.equal(second.state.activity.length,1);assert.equal(second.duplicate,true);
});
test('legacy sent records block only their recipient and ambiguous company replies are rejected',()=>{
 const old={opportunities:[{domain:'buyer.example',recipientEmail:'alice@buyer.example',sentAt:'2026-10-20T08:00:00Z'}]};
 assert.ok(D.findDeliveryRecord(old,pkg(),'alice@buyer.example')?.sentAt);
 assert.equal(D.findDeliveryRecord(old,pkg('bob'),'bob@buyer.example'),null);
 const two=sent(old,'bob');assert.equal(two.state.opportunities.length,2);
 const ambiguous=D.recordReply(two.state,'buyer.example','Hello','2026-10-24T10:00:00Z');assert.match(ambiguous.error,/select|recipient|ambiguous/i);
 const specific=D.recordReply(two.state,two.record.id,'Sounds interesting','2026-10-24T10:00:00Z');
 assert.equal(specific.error,'');assert.equal(specific.record.recipientEmail,'bob@buyer.example');assert.equal(specific.state.opportunities.find(r=>r.recipientEmail==='alice@buyer.example').replies.length,0);
});
test('history, replies and scorecard retain records beyond former display limits',()=>{
 let state={};for(let i=0;i<70;i++)state=D.confirmSend(state,approveMessage({...pkg(),domain:`company${i}.example`},{email:`alice@company${i}.example`}),`alice@company${i}.example`,'2026-10-24T09:00:00Z').state;
 for(let i=0;i<25;i++)state=D.recordReply(state,'company0.example','Reply '+i,`2026-10-24T10:${String(i).padStart(2,'0')}:00Z`).state;
 state=D.normalizeDeliveryState(JSON.parse(JSON.stringify(state)));
 assert.equal(state.opportunities.length,70);assert.equal(state.opportunities.find(r=>r.domain==='company0.example').replies.length,25);
 assert.equal(state.activity.length,95);assert.equal(D.buildLearningSummary(state).metrics.sent,70);
});
test('meeting interest remains Replied until an actual meeting outcome is recorded',()=>{
 let result=D.recordReply(sent({}).state,'buyer.example','Could we schedule a meeting next week?','2026-10-24T10:00:00Z');
 assert.equal(result.record.latestReplyCategory,'meeting_request');assert.equal(D.recommendedPipelineStage(result.record),'Replied');assert.equal(D.buildLearningSummary(result.state).metrics.meetings,0);
 result=D.recordOutcome(result.state,result.record.id,'Meeting','2026-10-24T11:00:00Z');assert.equal(D.buildLearningSummary(result.state).metrics.meetings,1);
});
test('a Gmail thread identifies its sent revision even beside a legacy send to the same recipient',()=>{
 const old={opportunities:[{domain:'buyer.example',recipientEmail:'alice@buyer.example',sentAt:'2026-10-20T08:00:00Z'}]};
 // Legacy data cannot establish whether a newly approved email was sent; keep its record intact.
 const state={opportunities:[...old.opportunities,{domain:'buyer.example',personId:'alice',approvedAt:'2026-10-24T08:00:00Z',recipientEmail:'alice@buyer.example',sentAt:'2026-10-24T09:00:00Z',threadId:'thread-new'}]};
 const reply=D.recordReply(state,{domain:'buyer.example',recipientEmail:'alice@buyer.example',threadId:'thread-new'},'Sounds interesting','2026-10-24T10:00:00Z');
 assert.equal(reply.error,'');assert.equal(reply.record.threadId,'thread-new');assert.equal(reply.state.opportunities.find(r=>!r.threadId).replies.length,0);
});
