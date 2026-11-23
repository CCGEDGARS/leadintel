const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const ui=fs.readFileSync(path.join(__dirname,'../discovery-ui.js'),'utf8');

// In the recordings of 20 and 21 Nov 2026 the user opened a saved company, pressed "Recheck" and "Review saved
// evidence" and nothing happened ("this one does not work, this one does not work, Move to Buyers works"). Both
// buttons were switched off because the Strategy was not approved, and the row said so nowhere.
const slice=(from,to)=>ui.slice(ui.indexOf(from),ui.indexOf(to,ui.indexOf(from)));
const rowSource=slice('function companyReviewActionsNote(','function companyReviewToolsHtml(');
const handlerStart=ui.indexOf('function handleCompanyReviewClick('),handlerEnd='}return false;}';
const handlerSource=ui.slice(handlerStart,ui.indexOf(handlerEnd,handlerStart)+handlerEnd.length);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function row({strategy={current:true},running=false,stored=true,selected=false,stale=true}={}){
 const candidate={company:'Welcon',domain:'welcon.dk'};
 const render=new Function('discovery','companyDisplayStrategyStatus','researchReviewStatus','researchReviewKey','buyerSelectionRows','canonicalDomain','esc','companySearchFeedbackHtml','companyCandidateCardHtml',rowSource+';return companyRankedCardBodyHtml;')(
  {status:running?'running':'idle'},()=>strategy,()=>({q:{},gaps:[],status:'needs-evidence',contextStale:stale}),c=>c.domain,()=>selected?[candidate]:[],value=>String(value||'').replace(/^https?:\/\//,'').replace(/\/.*$/,''),esc,()=>'',()=>'');
 const html=render({candidate,key:'welcon.dk',storedIndex:stored?0:-1,source:stored?'stored':'selection',score:84,scoreState:'previous',actionable:false},0,false,'Previous score');
 const document=new JSDOM(html).window.document,button=action=>document.querySelector(`[data-review-action="${action}"]`);
 return {document,button,note:document.querySelector('.research-review-blocked'),badge:document.querySelector('.research-review-status')};
}
const reason='Enable at least one customer profile and one buying signal, then review Strategy.';

test('with an unapproved Strategy the row says why Recheck and Review saved evidence are off and offers the way to Strategy',()=>{
 const r=row({strategy:{current:false,reason}});
 assert.equal(r.button('recheck').disabled,true);
 assert.equal(r.button('saved-evidence').disabled,true);
 assert.equal(r.button('buyers').disabled,false,'Move to Buyers is not tied to Strategy');
 assert.equal(r.button('remove').disabled,false);
 assert.ok(r.note,'the row carries a note');
 assert.equal(r.note.querySelector('span').textContent,'Recheck and Review saved evidence are off until Strategy is reviewed and approved. '+reason);
 assert.equal(r.button('recheck').title,r.note.querySelector('span').textContent,'the same words on the switched-off button');
 assert.equal(r.button('saved-evidence').title,r.note.querySelector('span').textContent);
 const open=r.button('open-strategy');
 assert.equal(open.textContent,'Open Strategy');
 assert.equal(open.disabled,false);
 assert.equal(open.closest('.research-review-blocked'),r.note);
});

test('with a current Strategy both buttons work and the row carries no note',()=>{
 const r=row({strategy:{current:true}});
 assert.equal(r.button('recheck').disabled,false);
 assert.equal(r.button('saved-evidence').disabled,false);
 assert.equal(r.note,null);
 assert.equal(r.button('recheck').title,'');
 assert.equal(r.button('saved-evidence').title,'No web requests. AI usage is billed separately.');
 assert.equal(r.button('open-strategy'),null);
});

test('while a search runs the note says the buttons come back when it finishes, without a Strategy link',()=>{
 const r=row({strategy:{current:true},running:true});
 assert.equal(r.button('recheck').disabled,true);
 assert.equal(r.note.querySelector('span').textContent,'Recheck and Review saved evidence are available again when the running search finishes.');
 assert.equal(r.button('open-strategy'),null);
});

test('a company kept only from an earlier Buyers selection says that it has nothing to recheck here',()=>{
 const r=row({strategy:{current:false,reason},stored:false,selected:true});
 for(const action of ['recheck','saved-evidence','buyers','remove'])assert.equal(r.button(action).disabled,true,action);
 assert.equal(r.note.querySelector('span').textContent,'Kept from your earlier selection for Buyers. It has no saved search evidence to recheck here.');
 assert.equal(r.button('open-strategy'),null);
});

test('the Needs recheck label explains itself on hover',()=>{
 const stale=row({strategy:{current:false,reason}});
 assert.equal(stale.badge.textContent,'Needs recheck');
 assert.equal(stale.badge.title,'Scored under an earlier Strategy. Review and approve Strategy, then press Recheck to score it again.');
 assert.equal(row({stale:false}).badge.title,'');
 assert.equal(row({stored:false,selected:true}).badge.title,'Not scored under the current Strategy.','a company that cannot be rechecked here is not told to press Recheck');
});

test('Open Strategy presses the step\'s own way back to Strategy',()=>{
 assert.ok(handlerSource.length>200,'the click handler was found in the source');
 let pressed=0;const calls=[];
 const handle=new Function('$','runCompanyDiscovery','rankedCompanyResults','selectResearchReviewForBuyers','unselectResearchReviewForBuyers','removeResearchReviewCompany','clearResearchReview',handlerSource+';return handleCompanyReviewClick;')(
  id=>id==='back-to-strategy'?{click(){pressed++;}}:null,(...a)=>calls.push(a),()=>({rows:[]}),()=>{},()=>{},()=>{},()=>{});
 const button={disabled:false,dataset:{reviewAction:'open-strategy'}};
 assert.equal(handle({target:{closest:selector=>selector==='[data-review-action]'?button:null}}),true);
 assert.equal(pressed,1);
 assert.deepEqual(calls,[],'no search is started');
});
