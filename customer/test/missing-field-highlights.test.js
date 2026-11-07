const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
test('unresolved fields highlight across formatting without altering saved text or HTML',()=>{
 const dom=new JSDOM('<textarea id="email"></textarea>',{url:'https://example.test',runScripts:'outside-only'}),w=dom.window;
 w.CSS={highlights:new Map()};w.Highlight=class extends Array{constructor(...ranges){super(...ranges);}};
 for(const name of ['rich-text','rich-text-editor'])w.eval(fs.readFileSync(path.join(__dirname,'..',name+'.js'),'utf8'));
 const input=w.document.querySelector('textarea');input.value='Hi Alex, [project location]. [reference]';input.readOnly=true;
 const editor=w.LeadIntelRichTextEditor.mount(input),html='Hi <strong>Alex</strong>, [project <em>location</em>]. [reference]';editor.setHtml(html);
 const key='leadintel-missing-email-rich';assert.deepEqual(Array.from(w.CSS.highlights.get(key),r=>r.toString()),['[project location]','[reference]']);
 assert.equal(editor.getHtml(),html);assert.equal(input.value,'Hi Alex, [project location]. [reference]');assert.equal(editor.body.querySelector('mark'),null);
 input.readOnly=false;editor.update();editor.body.textContent='Hi Alex, Kiruna. [reference]';editor.body.dispatchEvent(new w.Event('input',{bubbles:true}));
 assert.deepEqual(Array.from(w.CSS.highlights.get(key),r=>r.toString()),['[reference]']);assert.equal(input.value,'Hi Alex, Kiruna. [reference]');
 editor.destroy();assert.equal(w.CSS.highlights.has(key),false);assert.equal(w.document.getElementById(key+'-style'),null);w.close();
});
test('missing Highlight API does not block editing or save',()=>{
 const dom=new JSDOM('<textarea id="email">[reference]</textarea>',{runScripts:'outside-only',url:'https://example.test'}),w=dom.window;
 for(const name of ['rich-text','rich-text-editor'])w.eval(fs.readFileSync(path.join(__dirname,'..',name+'.js'),'utf8'));
 const input=w.document.querySelector('textarea'),editor=w.LeadIntelRichTextEditor.mount(input);assert.equal(editor.body.textContent,'[reference]');editor.destroy();w.close();
});
