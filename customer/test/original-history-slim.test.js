const test=require('node:test'),assert=require('node:assert/strict');
const O=require('../outreach-engine.js');

// Live 2026-10-22 (D1, read-only): one message's originalHistory held 10 earlier originals in
// 225 174 B, of which 192 661 B were their scope keys — each key is the whole serialized message
// context (~25 KB). Nothing reads originalHistory[].key; the history only preserves earlier drafts.
const bigScope=JSON.stringify(['workspace','buyer.example','p1','email','x'.repeat(24000)]);
function item(history,current='current-scope'){return {domain:'buyer.example',selectedPersonId:'p1',channel:'email',company:'Buyer',drafts:{emailBody:'Current body'},messageStudioDraft:{tailoredOriginal:{key:current,draft:{subject:'Now',message:'Current body'}},originalHistory:history}};}
const normalize=value=>O.normalizeOutreachState(JSON.parse(JSON.stringify({items:[value]}))).items[0];

test('earlier originals keep their drafts but store a short scope hash instead of the full scope key',()=>{
  const out=normalize(item([{key:bigScope,draft:{subject:'Old',message:'Old body'},style:'brief'}]));
  const [entry]=out.messageStudioDraft.originalHistory;
  assert.equal('key' in entry,false,'the full scope key is not stored in history');
  assert.match(entry.scopeHash,/^scope-[0-9a-z]{6,16}$/);
  assert.deepEqual(entry.draft,{subject:'Old',message:'Old body'});
  assert.equal(entry.style,'brief');
  assert.equal(out.messageStudioDraft.tailoredOriginal.key,'current-scope','the live scope key used for comparisons is untouched');
  assert.ok(JSON.stringify(out).length<JSON.stringify(item([{key:bigScope,draft:{}}])).length-20000);
});

test('scope hashes are deterministic and distinguish different scopes',()=>{
  const out=normalize(item([{key:bigScope,draft:{message:'a'}},{key:bigScope+'!',draft:{message:'b'}},{key:bigScope,draft:{message:'c'}}]));
  const [a,b,c]=out.messageStudioDraft.originalHistory.map(entry=>entry.scopeHash);
  assert.equal(a,c);assert.notEqual(a,b);
});

test('slimming is idempotent and leaves entries without a key alone',()=>{
  const once=normalize(item([{key:bigScope,draft:{message:'a'}},{scopeHash:'scope-legacy1',draft:{message:'b'}},null]));
  assert.equal(JSON.stringify(normalize(once).messageStudioDraft),JSON.stringify(once.messageStudioDraft),'history is settled after the first pass');
  // normalizeItem itself settles on its second pass (empty commercialContext fields).
  const settled=normalize(once);assert.equal(JSON.stringify(normalize(settled)),JSON.stringify(settled));
  assert.equal(once.messageStudioDraft.originalHistory[1].scopeHash,'scope-legacy1');
  assert.equal(once.messageStudioDraft.originalHistory[2],null);
});
