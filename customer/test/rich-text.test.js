const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../rich-text.js');
test('formatting allows lists, emphasis, typography and safe links without changing text',()=>{
 const html='<div style="font-family:Tahoma;font-size:18px"><p>Hello <b>Alex</b></p><ul><li>Quality</li><li><u>Costs</u></li></ul><a href="https://example.com">Details</a></div>';
 const safe=R.sanitize(html);assert.match(safe,/<ul>/);assert.match(safe,/<strong>Alex<\/strong>/);assert.match(safe,/font-family:Tahoma/);assert.match(safe,/<u>Costs/);assert.equal(R.matchingHtml(R.toText(safe),safe),safe);
});
test('unsafe paste is reduced to text and allowed formatting, stale HTML is never used',()=>{
 const html=R.sanitize('<p onclick="bad()">Hello<script>alert(1)</script><img src="https://evil.test/a"><a href="javascript:bad()">there</a><span style="position:fixed;color:red">!</span></p>');
 assert.doesNotMatch(html,/script|onclick|img|javascript|position|color/);assert.equal(R.toText(html),'Hellothere!');assert.equal(R.matchingHtml('New message','<b>Old message</b>'),'');
 assert.equal(R.matchingHtml('Hello','<b>Hello</b>'),'<strong>Hello</strong>');assert.equal(R.sanitize('x'.repeat(80001)),'');
});
test('plain text keeps line breaks and characters; revisions retain surviving emphasis and typography',()=>{
 const text='Hi Alex,\n\nQuality & costs < matter.\nNext line';assert.equal(R.toText(R.fromText(text)),text);
 const next=R.carry('<div style="font-family:Tahoma;font-size:18px">Hi <b>Alex</b><br><br>Quality</div>','Hi Alex\n\nQuality','Hello Alex\n\nQuality matters');assert.match(next,/<strong>Alex/);assert.match(next,/Tahoma/);assert.equal(R.toText(next),'Hello Alex\n\nQuality matters');
});
const {JSDOM}=require('jsdom'),{mount}=require('../rich-text-editor.js');
test('editor bolds selection, mirrors text and supports formatting-only undo, disabled state and safe paste',async()=>{
 const dom=new JSDOM('<textarea id="body">Hello Alex</textarea>',{url:'https://example.com',pretendToBeVisual:true}),d=dom.window.document,t=d.querySelector('textarea');let changes=0;t.oninput=()=>changes++;
 const e=mount(t),range=d.createRange(),selection=dom.window.getSelection();range.setStart(e.body.firstChild,6);range.setEnd(e.body.firstChild,10);selection.addRange(range);e.body.dispatchEvent(new dom.window.MouseEvent('mouseup'));e.command('bold');assert.match(e.getHtml(),/<strong>Alex/);assert.equal(t.value,'Hello Alex');assert.equal(changes,1);e.command('undo');assert.doesNotMatch(e.getHtml(),/<strong>/);e.command('redo');assert.match(e.getHtml(),/<strong>/);
 t.readOnly=true;await new Promise(r=>setImmediate(r));assert.equal(e.body.contentEditable,'false');assert.equal(e.toolbar.hidden,true);e.setHtml('<em>Hello Alex</em>',{context:'other'});assert.equal(e.toolbar.querySelector('[data-rich-command=undo]').disabled,true);e.destroy();dom.window.close();
});
test('native Enter divs, blank lines, lists and trailing soft breaks retain visible line boundaries',()=>{
 for(const [html,text] of [['Hello<div>Alex</div>','Hello\nAlex'],['Hello<div><br></div>','Hello\n'],['<div>Hello</div><div><br></div><div>Alex</div>','Hello\n\nAlex'],['Hello<ul><li>Quality</li><li>Costs</li></ul>Next','Hello\nQuality\nCosts\nNext'],['Hi<br><br>','Hi\n\n']])assert.equal(R.toText(html),text,html);
});
test('list structure survives revised items and template substitutions retain emphasis across split slots',()=>{
 const html='<ul><li><strong>Quality</strong></li><li>Costs</li></ul>';const result=R.carry(html,'Quality\nCosts','Better quality\nCosts');assert.match(result,/<ul>/);assert.match(result,/<li>Costs<\/li>/);assert.equal(R.toText(result),'Better quality\nCosts');
 assert.equal(R.substitute('Hello {{<strong>firstName</strong>}}',{firstName:'Alex'}),'Hello <strong>Alex</strong>');assert.equal(R.substitute('Hello <strong>Alex</strong>',{firstName:'Alex'},{slots:true}),'Hello <strong>{{firstName}}</strong>');
});
