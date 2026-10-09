const test=require('node:test'),assert=require('node:assert/strict');
const B=require('../brand-identity.js'),S=require('../message-studio.js'),E=require('../message-editor.js');
const base={sender:'Test Person',company:'Example',offer:'consulting',target:'businesses',problem:'delays',value:'simplify work',meetingValue:'compare requirements',nextAction:'Book: {{calendly}}',calendly:'https://calendly.com/example/call',language:'en'};
test('meeting preference survives identity save/reload and invalid choices default to Zoom',()=>{
 for(const platform of ['zoom','teams','google_meet'])assert.equal(B.normalize(JSON.parse(JSON.stringify(B.normalize({meetingPlatform:platform,senderName:'Test Person'})))).meetingPlatform,platform);
 assert.equal(B.normalize({meetingPlatform:'bad'}).meetingPlatform,'zoom');
});
test('all approved styles produce platform-specific working invitations while originals stay unchanged',()=>{
 const originals=JSON.stringify(S.defaults);
 for(const [platform,label] of [['zoom','Zoom'],['teams','Microsoft Teams'],['google_meet','Google Meet']])for(const channel of ['email','linkedin'])for(const mode of ['professional','curiosity','friendly',...(channel==='email'?['brutal']:[])]){
  const studio=S.normalize({mode,linkedinMode:mode,essentials:{...base,meetingPlatform:platform}});
  const result=E.tailor(studio,{channel,firstName:'Alex',buyerCompany:'Buyer'});assert.ok(result.message.includes(label),platform+' '+channel+' '+mode);assert.ok(result.message.includes(base.calendly));if(platform!=='zoom')assert.equal(/\bZoom\b/.test(result.message),false);
 }
 assert.equal(JSON.stringify(S.defaults),originals);
});
test('AI prompts and parser follow selected platform and reject mismatched invitations',()=>{
 for(const [platform,label] of [['zoom','Zoom'],['teams','Microsoft Teams'],['google_meet','Google Meet']]){
  const studio=S.normalize({mode:'professional',essentials:{...base,meetingPlatform:platform}}),context={buyerCompany:'Buyer'};
  assert.ok(S.prompt(studio,context).system.includes(label));
  const draft={subject:'Test Person. Example',message:`Hi Alex, a 20-minute ${label} conversation? ${base.calendly}`};
  assert.equal(S.parse(JSON.stringify(draft),studio.essentials,{studio,context}).message,draft.message);
  if(platform!=='zoom')assert.throws(()=>S.parse(JSON.stringify({...draft,message:`A 20-minute Zoom conversation? ${base.calendly}`}),studio.essentials,{studio,context}));
 }
});
test('workspace identity determines the platform for future messages',()=>{
 assert.equal(S.foundation({essentials:{...base,meetingPlatform:'zoom'}},{brandIdentity:{meetingPlatform:'teams'}}).essentials.meetingPlatform,'teams');
 assert.equal(S.foundation({essentials:{...base,meetingPlatform:'teams'}},{brandIdentity:{}}).essentials.meetingPlatform,'zoom');
});
test('settings selection saves immediately, reopens correctly and follows workspace switch',async()=>{
 const fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
 const root=path.join(__dirname,'..'),dom=new JSDOM('<div class="top-actions"></div><div id="toast"></div>',{url:'https://example.test/customer/',runScripts:'outside-only'}),w=dom.window;
 let identity={meetingPlatform:'zoom'};w.LeadIntelSenderIdentity={get:()=>identity,setMeetingPlatform:value=>{identity=B.normalize({...identity,meetingPlatform:value});w.localStorage.setItem('identity',JSON.stringify(identity));w.dispatchEvent(new w.CustomEvent('leadintel:sender-identity-changed'));}};
 w.eval(fs.readFileSync(path.join(root,'personal-linkedin.js'),'utf8'));w.eval(fs.readFileSync(path.join(root,'ai-settings.js'),'utf8').replace(/^import .*;\n/,''));const q=id=>w.document.getElementById(id);q('open-settings').click();
 assert.deepEqual([...q('meeting-platform').options].map(o=>o.value),['zoom','teams','google_meet']);
 for(const value of ['teams','google_meet','zoom']){q('meeting-platform').value=value;q('meeting-platform').dispatchEvent(new w.Event('change',{bubbles:true}));assert.equal(JSON.parse(w.localStorage.getItem('identity')).meetingPlatform,value);q('close-settings').click();q('open-settings').click();assert.equal(q('meeting-platform').value,value);}
 identity={meetingPlatform:'teams'};w.dispatchEvent(new w.CustomEvent('leadintel:workspace-changed'));assert.equal(q('meeting-platform').value,'teams');
 await new Promise(resolve=>setTimeout(resolve,10));dom.window.close();
});
