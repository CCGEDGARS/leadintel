const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('customer reload refreshes both save owners and the importing application module',()=>{
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8'),app=fs.readFileSync(require.resolve('../app.js'),'utf8');
 const cache=html.match(/src="(account-cache\.js[^\"]+)"/)?.[1],entry=html.match(/src="(app\.js[^\"]+)"/)?.[1],dependency=app.match(/import ['"]\.\/(workspace-persistence\.js[^'"]+)['"]/)?.[1];
 for(const [name,url]of [['archive owner',cache],['application entry',entry],['persistence dependency',dependency]])assert.match(url||'',/save-latency=20261116-v1/,name+' must load the same foreground-save revision');
});
