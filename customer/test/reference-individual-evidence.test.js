const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../reference-customer-ui.js'),'utf8');
const helper=source.slice(source.indexOf('  function individualReferenceCards('),source.indexOf('  function renderSegments('));
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const render=vm.runInNewContext(helper+';individualReferenceCards',{esc:escape});
test('reference evidence stays associated with its company and escapes supplied content',()=>{
const html=render({rows:[{id:'a',companyName:'A',website:'https://a.com'},{id:'b',companyName:'B',website:'https://b.com'}],analyses:{a:{industry:'Machinery',confidence:'medium',sourceEvidence:[{field:'industry',quote:'<script>bad</script>',url:'https://a.com/about'}]},b:{industry:'Forestry',confidence:'low'}}});
assert.match(html,/Machinery/);assert.match(html,/Forestry/);assert.match(html,/https:\/\/a.com\/about/);assert.ok(!html.includes('<script>'));assert.match(html,/Saved analysis has no supporting source quotes/);assert.match(html,/Refresh company analysis/);
});
test('an absent analysis is explicit rather than a ready profile',()=>{assert.match(render({rows:[{id:'a',companyName:'A'}],analyses:{}}),/Not analyzed yet/);});
