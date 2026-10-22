const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const BrandIdentity=require('../brand-identity.js');
const source=fs.readFileSync(require.resolve('../server-bridge.js'),'utf8');
function slice(start,end){const from=source.indexOf(start);assert.ok(from>=0,start);const to=source.indexOf(end,from);assert.ok(to>from,end);return source.slice(from,to);}

// Live 2026-10-22: the sync sanitizer dropped email and meetingPlatform and placed updatedAt before
// options, while app.js writes main.brandIdentity through BrandIdentity.normalize on every load. After
// each hydration main was rewritten, the workspace was marked dirty and saved again (v101 → v102 → v103
// with no edits), which made every other open device hydrate and save in turn; the sender email and a
// Teams/Google Meet choice never reached the server.
function sanitizer(){
  const context={root:{LeadIntelBrandIdentity:BrandIdentity},API_BASE:'https://leadintel-api.edgars-7e7.workers.dev'};
  vm.createContext(context);
  vm.runInContext(slice('const BRAND_ASSET_ID=','let saveTimer=')+slice('function isDataImagePayload(','function safeMainState(')+';this.safeBrandIdentity=safeBrandIdentity;',context);
  return context.safeBrandIdentity;
}
const identity={schemaVersion:1,status:'ready',revision:3,companyDisplayName:'Example SIA',senderName:'Anna Ozola',senderTitle:'CEO',website:'https://example.lv',phone:'+371 20000000',email:'anna@example.lv',linkedinUrl:'https://www.linkedin.com/in/anna',meetingPlatform:'teams',primaryColor:'#0F6557',signatureText:'Anna',legalFooter:'Example SIA',postalAddress:'Riga',options:{includeLogo:true,includeHeadshot:false,includeBanner:false},
  assets:{logo:{id:'A'.repeat(43),url:'https://leadintel-api.edgars-7e7.workers.dev/api/customer/brand-assets/'+'A'.repeat(43),mimeType:'image/png',width:120,height:60,altText:'Logo',updatedAt:'2026-10-20T10:00:00.000Z'},headshot:null,banner:null},updatedAt:'2026-10-21T09:30:00.000Z'};

test('the synced brand identity serializes exactly like the locally normalized one',()=>{
  const safeBrandIdentity=sanitizer();
  const normalized=BrandIdentity.normalize(identity);
  assert.equal(JSON.stringify(safeBrandIdentity(normalized)),JSON.stringify(normalized));
  assert.equal(JSON.stringify(safeBrandIdentity(BrandIdentity.normalize({}))),JSON.stringify(BrandIdentity.normalize({})));
});

test('a hydrated brand identity is not rewritten by the next normalize (no load-time save)',()=>{
  const safeBrandIdentity=sanitizer();
  const synced=JSON.parse(JSON.stringify(safeBrandIdentity(BrandIdentity.normalize(identity))));
  assert.equal(JSON.stringify(BrandIdentity.normalize(synced)),JSON.stringify(synced));
});

test('sender email and meeting platform reach the server',()=>{
  const synced=sanitizer()(BrandIdentity.normalize(identity));
  assert.equal(synced.email,'anna@example.lv');
  assert.equal(synced.meetingPlatform,'teams');
  assert.equal(sanitizer()(BrandIdentity.normalize({meetingPlatform:'skype'})).meetingPlatform,'zoom');
});

test('every field produced by normalize is kept by the sync sanitizer',()=>{
  const keys=Object.keys(BrandIdentity.normalize(identity));
  assert.deepEqual(Object.keys(sanitizer()(BrandIdentity.normalize(identity))),keys,'a new normalize field must be added to safeBrandIdentity, or every hydration saves again');
});

test('existing sanitizer protections still apply',()=>{
  const safeBrandIdentity=sanitizer();
  const synced=safeBrandIdentity({...identity,signatureText:'data:image/png;base64,AAAA',updatedAt:'not-a-date'});
  assert.equal(synced.signatureText,'');
  assert.equal(synced.status,'draft','ready requires a valid updatedAt');
  assert.equal(synced.updatedAt,'');
  assert.equal(safeBrandIdentity(null),null);
});
