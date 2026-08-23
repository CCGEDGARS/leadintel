import test from 'node:test';
import assert from 'node:assert/strict';
import {safeReturnUrl,buildGoogleAuthorizationUrl,exchangeGoogleCode,fetchGoogleIdentity,importAesKey,encryptSecret,decryptSecret} from '../src/oauth.js';

function base64(bytes){let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s);}

test('safeReturnUrl allows only configured customer origin and path',()=>{
  const configured='https://leadintel.ccgroup.lv/customer/';
  assert.equal(safeReturnUrl('https://leadintel.ccgroup.lv/customer/?auth=1',configured),'https://leadintel.ccgroup.lv/customer/?auth=1');
  assert.equal(safeReturnUrl('https://evil.example/customer/',configured),'');
  assert.equal(safeReturnUrl('https://leadintel.ccgroup.lv/v2/',configured),'');
});

test('buildGoogleAuthorizationUrl carries required OAuth parameters',()=>{
  const url=new URL(buildGoogleAuthorizationUrl({clientId:'cid',redirectUri:'https://api.example/callback',state:'abc',scopes:['openid','email'],accessType:'offline',prompt:'consent'}));
  assert.equal(url.origin,'https://accounts.google.com');
  assert.equal(url.searchParams.get('client_id'),'cid');
  assert.equal(url.searchParams.get('state'),'abc');
  assert.equal(url.searchParams.get('access_type'),'offline');
  assert.match(url.searchParams.get('scope'),/openid/);
});

test('exchangeGoogleCode posts form data and normalizes response',async()=>{
  let request;
  const fetchImpl=async(url,init)=>{request={url,init};return new Response(JSON.stringify({access_token:'access',refresh_token:'refresh',expires_in:3600,scope:'email'}),{status:200,headers:{'content-type':'application/json'}})};
  const result=await exchangeGoogleCode('code',{clientId:'cid',clientSecret:'secret',redirectUri:'https://api/cb'},fetchImpl);
  assert.equal(request.url,'https://oauth2.googleapis.com/token');
  assert.equal(request.init.method,'POST');
  assert.match(String(request.init.body),/grant_type=authorization%3Acode|grant_type=authorization_code/);
  assert.equal(result.refreshToken,'refresh');
});

test('fetchGoogleIdentity requires verified email',async()=>{
  const good=await fetchGoogleIdentity('token',async()=>new Response(JSON.stringify({sub:'1',email:'USER@EXAMPLE.COM',email_verified:true,name:'User'}),{status:200,headers:{'content-type':'application/json'}}));
  assert.equal(good.email,'user@example.com');
  await assert.rejects(()=>fetchGoogleIdentity('token',async()=>new Response(JSON.stringify({sub:'1',email:'u@example.com',email_verified:false}),{status:200,headers:{'content-type':'application/json'}})),/verified/);
});

test('AES-GCM token envelope round-trips and rejects tampering',async()=>{
  const key=await importAesKey(base64(crypto.getRandomValues(new Uint8Array(32))));
  const envelope=await encryptSecret('refresh-token-secret',key);
  assert.equal(await decryptSecret(envelope,key),'refresh-token-secret');
  const parsed=JSON.parse(envelope);parsed.ct=parsed.ct.slice(0,-2)+'aa';
  await assert.rejects(()=>decryptSecret(JSON.stringify(parsed),key),/authentication failed/);
});
