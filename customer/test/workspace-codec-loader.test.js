const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
test('deferred support modules cannot replace the installed workspace storage codec',()=>{
 const support=read('shell-support-loader.js');assert.doesNotMatch(support,/['"]\.\/state-budget\.js\?/);
 const html=read('index.html'),app=read('app.js');
 const bootstrap=html.match(/src="(state-budget\.js[^\"]+)"/)[1];const dependency=app.match(/import ['"]\.\/(state-budget\.js[^'"]+)['"]/)[1];assert.equal(dependency,bootstrap,'classic bootstrap and module dependency must share the same cache URL');
 assert.match(html,/shell-support-loader\.js\?[^\"]*codec-loader=20261011-v1/);
});
