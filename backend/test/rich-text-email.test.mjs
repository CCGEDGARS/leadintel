import test from 'node:test';import assert from 'node:assert/strict';
import {validateEmailContent} from '../src/email-content.js';import {buildMimeMessage} from '../src/gmail.js';import {validateScript} from '../src/script-library-routes.js';
test('rich list/underline/font HTML travels through strict validation and MIME with plain fallback',()=>{
 const html='<div style="font-family:Tahoma;font-size:18px"><strong>Hello</strong><ul><li><u>Quality</u></li><li>Costs</li></ul></div>';
 assert.equal(validateEmailContent({body:'Hello\nQuality\nCosts',html_body:html}).htmlBody,html);
 const mime=buildMimeMessage({to:'buyer@example.com',subject:'Hello',body:'Hello\nQuality\nCosts',htmlBody:html});assert.match(mime,/multipart\/alternative/);assert.match(mime,new RegExp(Buffer.from(html).toString('base64').slice(0,70)));
 assert.throws(()=>validateEmailContent({body:'Hi',html_body:'<ul onclick="bad()"><li>Hi</li></ul>'}),/Unsafe/);
});
test('personal email templates preserve safe matching HTML',()=>{const value=validateScript({channel:'email',name:'My template',subject:'Hello',body:'Hi {{firstName}}',bodyHtml:'Hi <b>{{firstName}}</b>'});assert.equal(value.bodyHtml,'Hi <strong>{{firstName}}</strong>');});
