import {redactProtectedData} from './copilot-security.js';

// Speed burst step 2 (2026-10-26): the model answers as JSON ({"answer":"…","action_proposals":[],"memory_candidates":[]}). These helpers stream
// the answer text out of the raw model chunks while they arrive, and redact it on the accumulated text before anything leaves the server.

const KEY='"answer"';
const ESCAPES={'"':'"','\\':'\\','/':'/','b':'\b','f':'\f','n':'\n','r':'\r','t':'\t'};

// Feeds raw model text; calls onText with decoded answer text as soon as it can be decoded. Tolerates fenced JSON, keys before "answer",
// and chunk boundaries anywhere (inside the key, inside an escape, inside a \uXXXX sequence). A missing or non-string answer streams nothing.
export function createAnswerStream(onText){
  let phase='seek',seek='',escaped=false,unicode=null;
  function push(chunk){
    let out='';
    for(const ch of String(chunk||'')){
      if(phase==='done')break;
      if(phase==='seek'){
        seek+=ch;const at=seek.indexOf(KEY);
        if(at<0){if(seek.length>KEY.length*2)seek=seek.slice(-KEY.length);continue;}
        const rest=seek.slice(at+KEY.length);
        if(/^\s*:\s*"/.test(rest)){phase='text';seek='';}
        else if(!/^\s*(?::\s*)?$/.test(rest))phase='done';
        continue;
      }
      if(unicode!==null){unicode+=ch;if(unicode.length===4){const code=parseInt(unicode,16);if(!Number.isNaN(code))out+=String.fromCharCode(code);unicode=null;}continue;}
      if(escaped){escaped=false;if(ch==='u'){unicode='';continue;}out+=ESCAPES[ch]??ch;continue;}
      if(ch==='\\'){escaped=true;continue;}
      if(ch==='"'){phase='done';break;}
      out+=ch;
    }
    if(out)onText(out);
  }
  return {push,end(){phase='done';}};
}

function stableLength(text){let i=text.length;while(i>0&&!/\s/.test(text[i-1]))i--;return i;}

// Accumulates answer text and emits only what is safe to show: the trailing partial token is held back until the next whitespace (secrets are
// whitespace-delimited tokens), redaction runs on the accumulated text, and if redaction ever changes text already emitted, one rewrite event
// replaces the whole answer. end() flushes the rest.
export function createRedactedEmitter(emit,redact=value=>redactProtectedData(String(value))){
  let accumulated='',sent='';
  const flush=final=>{
    const redacted=redact(accumulated.slice(0,final?accumulated.length:stableLength(accumulated)));
    if(redacted===sent)return;
    if(redacted.startsWith(sent)){const text=redacted.slice(sent.length);if(text)emit({text});}
    else emit({text:redacted,replace:true});
    sent=redacted;
  };
  return {push(text){accumulated+=String(text||'');flush(false);},end(){flush(true);}};
}
