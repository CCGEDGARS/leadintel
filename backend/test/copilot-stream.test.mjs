import test from 'node:test';
import assert from 'node:assert/strict';
import {createAnswerStream,createRedactedEmitter} from '../src/copilot-stream.js';

// Speed burst step 2 (2026-10-26): the model answers as JSON; the answer string is streamed out of it as it arrives.
const payload=JSON.stringify({research_query:'',answer:'Jonathan, sāc ar Latviju.\n\nTālāk: "pārbaudi" ICP → ā.',action_proposals:[],memory_candidates:[]});
const expected='Jonathan, sāc ar Latviju.\n\nTālāk: "pārbaudi" ICP → ā.';

test('the answer string is extracted from a complete JSON payload with escapes and unicode decoded',()=>{
  const out=[];const stream=createAnswerStream(text=>out.push(text));stream.push(payload);stream.end();
  assert.equal(out.join(''),expected);
});

test('the answer survives arbitrary chunk boundaries, including inside escapes and the key itself',()=>{
  for(const size of [1,2,3,5,7,11]){const out=[];const stream=createAnswerStream(text=>out.push(text));for(let i=0;i<payload.length;i+=size)stream.push(payload.slice(i,i+size));stream.end();assert.equal(out.join(''),expected,`chunk size ${size}`);}
});

test('fenced JSON and keys before the answer do not break extraction; a missing answer key streams nothing',()=>{
  const out=[];const stream=createAnswerStream(text=>out.push(text));stream.push('```json\n'+payload+'\n```');stream.end();assert.equal(out.join(''),expected);
  const none=[];const empty=createAnswerStream(text=>none.push(text));empty.push('{"research_query":"Tele2 news","memory_candidates":[]}');empty.end();assert.deepEqual(none,[]);
  const notString=[];const other=createAnswerStream(text=>notString.push(text));other.push('{"answer":null,"x":"y"}');other.end();assert.deepEqual(notString,[]);
});

test('text after the closing quote is ignored',()=>{
  const out=[];const stream=createAnswerStream(text=>out.push(text));stream.push('{"answer":"Done.","action_proposals":[],"memory_candidates":[{"kind":"fact","value":"not streamed"}]}');stream.end();
  assert.equal(out.join(''),'Done.');
});

test('the redacted emitter holds back the trailing partial token and never lets a split secret through',()=>{
  const events=[];const gate=createRedactedEmitter(event=>events.push(event));
  gate.push('Use key sk-abcdefghij');gate.push('klmnop1234 for');gate.push(' the test.');gate.end();
  const sent=events.map(event=>event.text).join('');
  for(const event of events)assert.doesNotMatch(event.text,/sk-abcdefghij/,'no emitted chunk contains the secret or its beginning');
  assert.equal(events.filter(event=>event.replace).length,0);
  assert.equal(sent,'Use key [redacted] for the test.');
});

test('plain text streams progressively: words appear as soon as the next whitespace arrives, the end flushes the rest',()=>{
  const events=[];const gate=createRedactedEmitter(event=>events.push(event));
  gate.push('Hel');assert.deepEqual(events,[]);gate.push('lo wor');assert.deepEqual(events.map(event=>event.text),['Hello ']);gate.push('ld');gate.end();
  assert.deepEqual(events.map(event=>event.text),['Hello ','world']);assert.ok(events.every(event=>!event.replace));
});

test('when redaction changes text already sent, the emitter rewrites the whole answer once',()=>{
  const events=[];const gate=createRedactedEmitter(event=>events.push(event));
  gate.push('Header: bearer ');gate.push('abcdefghijkl done');gate.end();
  const rewrite=events.find(event=>event.replace);assert.ok(rewrite,'a rewrite event is emitted');assert.match(rewrite.text,/\[redacted\]/);assert.doesNotMatch(rewrite.text,/abcdefghijkl/);
});
