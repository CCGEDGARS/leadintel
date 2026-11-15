const test=require('node:test'),assert=require('node:assert/strict');
const Events=require('../event-campaigns.js'),Writing=require('../writing-assistant-context.js');
const event={id:'future-forum',name:'Future Industry Forum',startDate:'2099-10-10',endDate:'2099-10-12',location:'Berlin',role:'exhibitor',stand:'',visitValue:'Discuss the project scope.',bookingUrl:''};
const seller={sender:'Robin Lane',company:'North Works',calendly:'https://calendly.com/north/web-call',meetingPlatform:'zoom'};

test('an event without its own booking link requests a reply without inheriting the business web-call link',()=>{
 const before=JSON.stringify(seller);
 for(const role of ['exhibitor','visitor']){
  const campaign={...event,role,meetingPoint:role==='visitor'?'Lobby':''};
  const draft=Events.draft(campaign,seller,{name:'Alex Buyer'});
  assert.match(draft.message,/Reply with your availability/);
  assert.ok(!draft.message.includes(seller.calendly));
  Events.validateDraft(campaign,draft,seller);
 }
 assert.equal(JSON.stringify(seller),before,'the business booking setting remains available to its own message');
});

test('an explicitly supplied event booking link is preserved',()=>{
 const campaign={...event,bookingUrl:'https://meet.example/forum'};
 const draft=Events.draft(campaign,seller,{name:'Alex Buyer'});
 assert.ok(draft.message.includes(campaign.bookingUrl));assert.ok(!draft.message.includes(seller.calendly));
});

test('Writing Assistant uses only the event booking setting while business writing keeps its web-call settings',()=>{
 function capture(campaign){return Writing.captureWritingContext({workspace:'w1',item:{domain:'buyer.example',channel:'email',selectedPersonId:'alex',messageStudioDraft:campaign?{eventSnapshot:campaign}:{}},candidate:{company:'Buyer'},person:{id:'alex',name:'Alex Buyer'},studio:{mode:'professional',essentials:seller},facts:{},currentDraft:{subject:'Meeting',message:'Hi Alex, Robin Lane here.'},refs:{workspaceId:'w1',referenceRevision:1,sourceRefs:[]},usable:true}).context;}
 const ordinary=capture(null);assert.equal(ordinary.seller.calendly,seller.calendly);assert.equal(ordinary.seller.meetingPlatform,'zoom');
 const reply=capture(event);assert.equal(reply.seller.calendly,'');assert.equal(reply.seller.meetingPlatform,'');assert.equal(reply.eventCampaign.id,event.id);
 const booked=capture({...event,bookingUrl:'https://meet.example/forum'});assert.equal(booked.seller.calendly,'https://meet.example/forum');assert.equal(seller.calendly,'https://calendly.com/north/web-call');
});
