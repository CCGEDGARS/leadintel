const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
function model(){const context={URL,module:{exports:{}}};vm.runInNewContext(fs.readFileSync(path.join(root,'personal-linkedin.js'),'utf8'),context);return context.module.exports;}
test('personal profile validation accepts only LinkedIn personal profiles and canonicalizes tracking',()=>{
 const m=model();
 assert.equal(m.normalize('linkedin.com/in/example/?trk=share#about'),'https://www.linkedin.com/in/example/');
 assert.equal(m.normalize('https://lv.linkedin.com/in/example'),'https://www.linkedin.com/in/example/');
 for(const url of ['https://linkedin.com/company/example','https://linkedin.com.evil.com/in/example','javascript:alert(1)','https://evil.com/in/example','https://user:password@linkedin.com/in/example','https://linkedin.com:8080/in/example','http://linkedin.com/in/example','https://linkedin.com/feed','https://linkedin.com/in/example/posts'])assert.equal(m.normalize(url),'',url);
});
test('saving and removing use the sender identity source and preserve other identity fields',()=>{
 const m=model();let identity={senderName:'Test Person',linkedinUrl:''};const sender={get:()=>identity,setLinkedIn:value=>{identity={...identity,linkedinUrl:value};return identity;}};
 assert.equal(m.save(sender,'linkedin.com/in/test').url,'https://www.linkedin.com/in/test/');
 assert.equal(identity.senderName,'Test Person');
 assert.throws(()=>m.save(sender,'https://evil.com/in/test'));
 assert.equal(identity.linkedinUrl,'https://www.linkedin.com/in/test/');
 m.save(sender,'');assert.equal(identity.linkedinUrl,'');
 assert.throws(()=>m.save(null,'linkedin.com/in/test'));
});
test('settings exposes personal link without presenting OAuth or automatic messaging',()=>{
 const source=fs.readFileSync(path.join(root,'ai-settings.js'),'utf8');
 for(const text of ['id="personal-linkedin-url"','Save profile','Open my LinkedIn','Profile linked','No LinkedIn sign-in or automatic sending'])assert.ok(source.includes(text),text);
 assert.match(source,/rel="noopener noreferrer"/);
 assert.match(source,/LeadIntelPersonalLinkedIn\.save/);
 const app=fs.readFileSync(path.join(root,'app.js'),'utf8');assert.match(app,/setLinkedIn\(url\)/);assert.match(app,/get:\(\)=>\(\{\.\.\.state.brandIdentity\}\)/);
});
test('settings save/open/remove/reopen and workspace switch reflect canonical identity',async()=>{
 const {JSDOM}=require('jsdom');const dom=new JSDOM('<div class="top-actions"></div><div id="toast"></div>',{url:'https://example.test/customer/',runScripts:'outside-only'});const w=dom.window;
 let identity={senderName:'Test Person',linkedinUrl:''};
 w.LeadIntelSenderIdentity={get:()=>identity,setLinkedIn:url=>{identity={...identity,linkedinUrl:url};w.localStorage.setItem('identity',JSON.stringify(identity));w.dispatchEvent(new w.CustomEvent('leadintel:sender-identity-changed'));}};
 w.eval(fs.readFileSync(path.join(root,'personal-linkedin.js'),'utf8'));
 w.eval(fs.readFileSync(path.join(root,'ai-settings.js'),'utf8').replace(/^import .*;\n/,''));
 const q=id=>w.document.getElementById(id);q('open-settings').click();
 q('personal-linkedin-url').value='linkedin.com/in/test-person?trk=share';q('personal-linkedin-save').click();
 assert.equal(JSON.parse(w.localStorage.getItem('identity')).linkedinUrl,'https://www.linkedin.com/in/test-person/');
 assert.equal(q('personal-linkedin-open').href,identity.linkedinUrl);assert.equal(q('personal-linkedin-open').hidden,false);
 q('close-settings').click();q('open-settings').click();assert.equal(q('personal-linkedin-url').value,identity.linkedinUrl);
 q('personal-linkedin-url').value='https://evil.test/in/fake';q('personal-linkedin-save').click();assert.equal(q('personal-linkedin-url').getAttribute('aria-invalid'),'true');assert.equal(identity.linkedinUrl,'https://www.linkedin.com/in/test-person/');
 q('personal-linkedin-remove').click();assert.equal(identity.linkedinUrl,'');assert.equal(q('personal-linkedin-open').hasAttribute('href'),false);
 identity={senderName:'Other Person',linkedinUrl:'https://www.linkedin.com/in/other/'};w.dispatchEvent(new w.CustomEvent('leadintel:workspace-changed'));assert.equal(q('personal-linkedin-url').value,identity.linkedinUrl);
 await new Promise(resolve=>setTimeout(resolve,10));dom.window.close();
});
