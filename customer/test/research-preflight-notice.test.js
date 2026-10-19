const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
test('the market-research plan screen has a provider pre-flight line fed by the attention model',()=>{
 const html=read('index.html'),app=read('app.js');
 assert.match(html,/<p id="research-preview-providers" class="research-preview-providers" hidden><\/p>/);
 assert.match(app,/LeadIntelAttentionModel\?\.researchProviderNotice\?\.\(globalThis\.LeadIntelAttention\?\.providerStatus\?\.\(\)/);
 assert.match(app,/providerNode\.hidden=!providerNotice/);
 assert.match(read('market.css'),/\.research-preview-providers\{/);
});
test('the Companies review names Apollo and discovery providers that are not connected',()=>{
 const app=read('app.js');
 assert.match(app,/providerConnected\("apollo"\)\)warnings\.push\("Apollo is not connected/);
 assert.match(app,/!providerConnected\("openai"\)&&!providerConnected\("gemini"\)\)warnings\.push\("OpenAI and Google Gemini are not connected/);
});
test('the attention centre exposes the last provider status for pre-flight checks',()=>{
 const centre=read('attention-centre.js');
 assert.match(centre,/lastProviderStatus=\{ai,services,checkedAt:Date\.now\(\)\}/);
 assert.match(centre,/providerStatus:\(\)=>lastProviderStatus/);
});
