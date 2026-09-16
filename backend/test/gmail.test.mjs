import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMimeMessage,base64UrlEncode,base64UrlDecode,refreshGoogleAccessToken,sendGmailMessage,extractMessageText,normalizeInboundReplies,classifyReply} from '../src/gmail.js';

test('MIME builder uses CRLF, encodes subject and rejects header injection',()=>{
  const mime=buildMimeMessage({from:'sender@example.com',to:'buyer@example.com',subject:'Sveiki ✓',body:'Line 1\nLine 2'});
  assert.match(mime,/To: buyer@example\.com\r\n/);
  assert.match(mime,/Subject: =\?UTF-8\?B\?/);
  assert.match(mime,/\r\n\r\nLine 1\r\nLine 2$/);
  assert.throws(()=>buildMimeMessage({to:'buyer@example.com\r\nBcc:x@example.com',subject:'x',body:'y'}),/Valid recipient/);
  assert.throws(()=>buildMimeMessage({to:'buyer@example.com',subject:'Safe\r\nBcc: victim@example.com',body:'y'}),/header/i);
});

test('HTML MIME uses a unique safe multipart boundary and UTF-8 alternatives',()=>{
  const input={from:'sender@example.com',to:'buyer@example.com',subject:'Branded ✓',body:'Plain ✓',htmlBody:'<div>Branded ✓</div>'};
  const first=buildMimeMessage(input);const second=buildMimeMessage(input);
  const boundary=/boundary="([A-Za-z0-9_-]+)"/.exec(first)?.[1];
  const secondBoundary=/boundary="([A-Za-z0-9_-]+)"/.exec(second)?.[1];
  assert.match(boundary,/^leadintel_[A-Za-z0-9_-]{20,}$/);
  assert.notEqual(boundary,secondBoundary);
  assert.match(first,new RegExp(`Content-Type: multipart/alternative; boundary="${boundary}"\\r\\n`));
  const parts=first.split(`--${boundary}`);
  assert.equal(parts.length,4);
  const plainEncoded=parts[1].split('\r\n\r\n')[1].trim();
  const htmlEncoded=parts[2].split('\r\n\r\n')[1].trim();
  assert.equal(Buffer.from(plainEncoded.replace(/\s/g,''),'base64').toString('utf8'),'Plain ✓');
  assert.equal(Buffer.from(htmlEncoded.replace(/\s/g,''),'base64').toString('utf8'),'<div>Branded ✓</div>');
  assert.match(parts[1],/Content-Type: text\/plain; charset=UTF-8/);
  assert.match(parts[2],/Content-Type: text\/html; charset=UTF-8/);
});

test('base64url helpers preserve UTF-8',()=>{
  const input='Labdien ✓';assert.equal(base64UrlDecode(base64UrlEncode(input)),input);
});

test('refresh token and Gmail send use correct Google endpoints',async()=>{
  const calls=[];const fetchImpl=async(url,init)=>{calls.push({url,init});if(url.includes('oauth2.googleapis.com'))return new Response(JSON.stringify({access_token:'a',expires_in:3600}),{status:200,headers:{'content-type':'application/json'}});return new Response(JSON.stringify({id:'m1',threadId:'t1'}),{status:200,headers:{'content-type':'application/json'}})};
  const refreshed=await refreshGoogleAccessToken('refresh',{clientId:'cid',clientSecret:'sec'},fetchImpl);assert.equal(refreshed.accessToken,'a');
  const sent=await sendGmailMessage('a','To: buyer@example.com\r\n\r\nHello',fetchImpl);assert.deepEqual(sent,{id:'m1',threadId:'t1',labelIds:[]});
  assert.match(calls[0].url,/oauth2\.googleapis\.com\/token/);assert.match(calls[1].url,/gmail\.googleapis\.com\/gmail\/v1\/users\/me\/messages\/send/);
  assert.ok(JSON.parse(calls[1].init.body).raw);
});

test('extractMessageText decodes Gmail payload and replies are normalized',()=>{
  const text='Can we schedule a call next week?';
  const thread={id:'t1',messages:[
    {id:'sent',threadId:'t1',internalDate:'1000',payload:{headers:[{name:'From',value:'me@example.com'}],mimeType:'text/plain',body:{data:base64UrlEncode('Original')}}},
    {id:'reply',threadId:'t1',internalDate:'3000',payload:{headers:[{name:'From',value:'Buyer <buyer@example.com>'}],mimeType:'multipart/alternative',parts:[{mimeType:'text/plain',body:{data:base64UrlEncode(text)}}]}}
  ]};
  assert.equal(extractMessageText(thread.messages[1]),text);
  const replies=normalizeInboundReplies(thread,{sentMessageId:'sent',sentAt:new Date(2000).toISOString(),connectedEmail:'me@example.com'});
  assert.equal(replies.length,1);assert.equal(replies[0].senderEmail,'buyer@example.com');assert.equal(replies[0].category,'meeting_request');
});

test('reply classifier remains conservative',()=>{
  assert.equal(classifyReply('Sounds good, please share more details.'),'positive');
  assert.equal(classifyReply('We already have an existing supplier.'),'objection');
  assert.equal(classifyReply('Please circle back next quarter.'),'not_now');
  assert.equal(classifyReply('Automatic reply: I am out of office.'),'out_of_office');
  assert.equal(classifyReply('Thanks for your email.'),'neutral');
});
