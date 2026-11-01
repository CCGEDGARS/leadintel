import test from 'node:test';
import assert from 'node:assert/strict';
import {exposePublishedEmailHtml} from '../src/published-email-html.js';
import {fetchDirectPublicPage} from '../src/service-integrations.js';
import {createRequire} from 'node:module';
const D=createRequire(import.meta.url)('../../customer/discovery-engine.js');
const encode=value=>'42'+[...value].map(c=>(c.charCodeAt(0)^0x42).toString(16).padStart(2,'0')).join('');
test('protected addresses survive actual public-page extraction and remain unverified listings',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>new Response('<h2>Jane Smith</h2><p>Procurement Director</p><span data-cfemail="'+encode('jane@buyer.example')+'">[email protected]</span><p><a data-user="office" data-domain="buyer.example">Email office</a></p>',{headers:{'Content-Type':'text/html'}});
 try{
  const result=await fetchDirectPublicPage('https://buyer.example/team'),page={...result.data,url:'https://buyer.example/team',sourceRead:true};
  assert.match(page.markdown,/jane@buyer.example/);assert.match(page.markdown,/office@buyer.example/);
  const contacts=D.extractPublicContacts([page],'buyer.example');
  assert.equal(contacts.filter(c=>c.kind==='email').length,2);assert.ok(contacts.every(c=>c.status==='public_unverified'));
  assert.ok(contacts.every(c=>c.url===page.url));
 }finally{globalThis.fetch=original;}
});
test('link-only protection decodes but malformed, unsafe and cross-element attributes do not',()=>{
 assert.match(exposePublishedEmailHtml('<a href="/cdn-cgi/l/email-protection#'+encode('jane@buyer.example')+'">Contact</a>'),/jane@buyer.example/);
 for(const html of ['<b data-user="jane"></b><b data-domain="buyer.example">Email</b>','<span data-cfemail="xyz">Email</span>','<span data-cfemail="'+encode('jane@buyer.example\nBcc:evil@example.com')+'">Email</span>','<b data-user="jane" data-domain="buyer.example<script>">Email</b>','<b data-user="jane" data-user="other" data-domain="buyer.example">Email</b>'])assert.equal(exposePublishedEmailHtml(html),html);
});
test('comments and executable containers cannot supply decoded contact evidence',async()=>{
 const original=globalThis.fetch,hidden='<b data-cfemail="'+encode('hidden@buyer.example')+'">Hidden</b>';
 globalThis.fetch=async()=>new Response('<p>Company contact information.</p><!--'+hidden+'--><script>'+hidden+'</script><template>'+hidden+'</template>',{headers:{'Content-Type':'text/html'}});
 try{const result=await fetchDirectPublicPage('https://buyer.example/contact');assert.doesNotMatch(result.data.markdown,/@|hidden/i);}finally{globalThis.fetch=original;}
});
