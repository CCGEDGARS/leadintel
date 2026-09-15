import test from 'node:test';
import assert from 'node:assert/strict';

const microsoftMail=await import('../src/microsoft-mail.js').catch(()=>({}));

test('Microsoft refresh exchanges the stored token and preserves token rotation',async()=>{
  assert.equal(typeof microsoftMail.refreshMicrosoftAccessToken,'function','Microsoft refresh transport must exist');
  let request;
  const scopes=['openid','offline_access','https://graph.microsoft.com/User.Read','https://graph.microsoft.com/Mail.Send'];
  const fetchImpl=async(url,init)=>{request={url,init};return new Response(JSON.stringify({access_token:'access-2',refresh_token:'refresh-2',expires_in:3600,scope:scopes.join(' ')}),{status:200,headers:{'content-type':'application/json'}})};
  const result=await microsoftMail.refreshMicrosoftAccessToken('refresh-1',{clientId:'cid',clientSecret:'secret',scopes},fetchImpl);
  const form=new URLSearchParams(String(request.init.body));
  assert.equal(request.url,'https://login.microsoftonline.com/common/oauth2/v2.0/token');
  assert.equal(form.get('grant_type'),'refresh_token');
  assert.equal(form.get('refresh_token'),'refresh-1');
  assert.equal(form.get('scope'),scopes.join(' '));
  assert.deepEqual(result,{accessToken:'access-2',refreshToken:'refresh-2',expiresIn:3600,scope:scopes.join(' ')});
});

test('Microsoft Graph sendMail submits a tailored plain-text message and treats only 202 as accepted',async()=>{
  assert.equal(typeof microsoftMail.sendMicrosoftMessage,'function','Microsoft send transport must exist');
  let request;
  const fetchImpl=async(url,init)=>{request={url,init};return new Response(null,{status:202})};
  const result=await microsoftMail.sendMicrosoftMessage('access-token',{to:'buyer@example.com',subject:'A tailored subject',body:'A tailored body'},fetchImpl);
  assert.equal(request.url,'https://graph.microsoft.com/v1.0/me/sendMail');
  assert.equal(request.init.method,'POST');
  const payload=JSON.parse(request.init.body);
  assert.equal(payload.message.subject,'A tailored subject');
  assert.deepEqual(payload.message.toRecipients,[{emailAddress:{address:'buyer@example.com'}}]);
  assert.deepEqual(payload.message.body,{contentType:'Text',content:'A tailored body'});
  assert.equal(payload.saveToSentItems,true);
  assert.deepEqual(result,{accepted:true,status:202});
});

test('Microsoft Graph sendMail rejects invalid recipients before calling Graph',async()=>{
  assert.equal(typeof microsoftMail.sendMicrosoftMessage,'function','Microsoft send transport must exist');
  let called=false;
  await assert.rejects(()=>microsoftMail.sendMicrosoftMessage('access-token',{to:'not-an-email',subject:'Subject',body:'Body'},async()=>{called=true;return new Response(null,{status:202});}),/recipient/i);
  assert.equal(called,false);
});
