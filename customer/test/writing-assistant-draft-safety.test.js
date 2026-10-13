const test=require('node:test'),assert=require('node:assert/strict');
const Context=require('../writing-assistant-context.js');
const context={seller:{sender:'Bob Seller',booking:'https://calendar.example/bob',proof:'https://seller.example/projects'},currentDraft:{subject:'Original',message:'Bob Seller invites you to a 20-minute call. https://calendar.example/bob'}};
const draft={subject:'A practical conversation',message:'Bob Seller proposes a 20-minute call. https://calendar.example/bob'};
test('assistant cannot bypass existing link, sender and meeting commitments',()=>{
  assert.equal(typeof Context.validateWritingDraft,'function');
  assert.doesNotThrow(()=>Context.validateWritingDraft(draft,context));
  for(const message of ['Bob Seller proposes a 20-minute call.','Someone else proposes a 20-minute call. https://calendar.example/bob','Bob Seller proposes a 30-minute call. https://calendar.example/bob'])assert.throws(()=>Context.validateWritingDraft({...draft,message},context),/link|sender|duration/i);
});
test('assistant rejects invented links but can use explicitly supplied seller links',()=>{
  assert.equal(typeof Context.validateWritingDraft,'function');
  assert.throws(()=>Context.validateWritingDraft({...draft,message:draft.message+' https://invented.example'},context),/unapproved link/i);
  assert.doesNotThrow(()=>Context.validateWritingDraft({...draft,message:draft.message+' https://seller.example/projects'},context));
});
test('malformed assistant drafts cannot mutate the working copy',()=>{
  assert.equal(typeof Context.validateWritingDraft,'function');
  for(const invalid of [null,{subject:'Valid',message:[]},{...draft,subject:'x'.repeat(61)},{...draft,subject:'Subject: unsupported'},{...draft,subject:'two\nlines'},{...draft,message:draft.message+' {{unfilled}}'}])assert.throws(()=>Context.validateWritingDraft(invalid,context));
});
test('LinkedIn drafts preserve identity and links without requiring an email subject',()=>{
  assert.equal(typeof Context.validateWritingDraft,'function');
  assert.doesNotThrow(()=>Context.validateWritingDraft({...draft,subject:''},{...context,channel:'linkedin'}));
});
