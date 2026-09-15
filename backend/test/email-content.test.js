import test from 'node:test';
import assert from 'node:assert/strict';
import {validateEmailContent} from '../src/email-content.js';

const ASSET_ID='A'.repeat(43);
const ASSET_URL=`https://leadintel-api.edgars-7e7.workers.dev/api/customer/brand-assets/${ASSET_ID}`;

test('body-only content preserves the canonical plain-text body',()=>{
  assert.deepEqual(validateEmailContent({body:'  Hello buyer.  '}),{
    body:'Hello buyer.',
    textBody:'Hello buyer.',
    htmlBody:''
  });
});

test('safe branded email markup and links survive validation unchanged',()=>{
  const html='<!doctype html><html><body style="margin:0;padding:0;background:#ffffff;color:#1f2933;font-family:Arial,Helvetica,sans-serif;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#ffffff;"><tr><td align="center"><div style="font-size:16px;line-height:1.55;color:#1f2933;">Hello<br>Buyer</div><a href="https://example.com/path?q=1" style="color:#0f6557;text-decoration:underline;">Website</a><a href="tel:+37120000000">Call</a><img src="'+ASSET_URL+'" alt="Seller logo" style="display:block;max-width:140px;max-height:48px;width:auto;height:auto;border:0;margin:0 0 20px 0;"></td></tr></table></body></html>';
  assert.deepEqual(validateEmailContent({body:'Canonical',text_body:'Hello\nBuyer',html_body:html}),{
    body:'Canonical',
    textBody:'Hello\nBuyer',
    htmlBody:html
  });
});

for(const [label,html] of [
  ['scripts','<div><script>alert(1)</script></div>'],
  ['event handlers','<div onclick="alert(1)">Hello</div>'],
  ['javascript links','<a href="javascript:alert(1)">Click</a>'],
  ['data links','<a href="data:text/html,boom">Click</a>'],
  ['forms','<form action="https://example.com"><input></form>'],
  ['SVG','<svg><circle></circle></svg>'],
  ['CSS URLs','<div style="background:url(https://tracker.example/pixel)">Hello</div>'],
  ['external images','<img src="https://images.example/logo.png" alt="Logo">'],
  ['relative external images','<img src="/other/image.png" alt="Logo">'],
  ['tracking pixels','<img src="'+ASSET_URL+'" alt="" width="1" height="1">'],
  ['styled tracking pixels','<img src="'+ASSET_URL+'" alt="" style="display:block;width:1px;height:1px;">'],
  ['credentialed links','<a href="https://user:pass@example.com">Click</a>'],
  ['protocol-relative links','<a href="//example.com">Click</a>'],
  ['HTML comments','<!-- hidden --><div>Hello</div>'],
  ['malformed tags','<div title="unterminated>Hello</div>']
]){
  test(`unsafe HTML is rejected: ${label}`,()=>{
    assert.throws(()=>validateEmailContent({body:'Hello',html_body:html}),/unsafe email HTML/i);
  });
}

test('only the exact opaque LeadIntel asset route is accepted for images',()=>{
  for(const src of [
    `https://leadintel-api.edgars-7e7.workers.dev/api/customer/brand-assets/${'a'.repeat(42)}`,
    `https://leadintel-api.edgars-7e7.workers.dev/api/customer/brand-assets/${ASSET_ID}?track=1`,
    `https://leadintel-api.edgars-7e7.workers.dev.evil.example/api/customer/brand-assets/${ASSET_ID}`,
    `https://leadintel-api.edgars-7e7.workers.dev/api/customer/brand-assets/${ASSET_ID}/extra`
  ]){
    assert.throws(()=>validateEmailContent({body:'Hello',html_body:`<img src="${src}" alt="Logo">`}),/unsafe email HTML/i);
  }
});

test('empty and over-limit text or HTML payloads are rejected by UTF-8 byte size',()=>{
  assert.throws(()=>validateEmailContent({body:'   '}),/body is required/i);
  assert.throws(()=>validateEmailContent({body:'x'.repeat(100001)}),/body is too large/i);
  assert.throws(()=>validateEmailContent({body:'Hello',text_body:'✓'.repeat(33334)}),/text body is too large/i);
  assert.throws(()=>validateEmailContent({body:'Hello',html_body:`<div>${'x'.repeat(200001)}</div>`}),/HTML body is too large/i);
});

test('optional rendered parts fall back to the canonical body without breaking plain text',()=>{
  assert.deepEqual(validateEmailContent({body:'Canonical',html_body:'<div>Hello</div>'}),{
    body:'Canonical',textBody:'Canonical',htmlBody:'<div>Hello</div>'
  });
  assert.deepEqual(validateEmailContent({body:'Canonical',text_body:'Rendered text'}),{
    body:'Canonical',textBody:'Rendered text',htmlBody:''
  });
});
