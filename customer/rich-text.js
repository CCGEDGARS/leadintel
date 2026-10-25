(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.LeadIntelRichText=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const MAX_HTML=80000,FONTS=['Arial','Tahoma','Verdana','Georgia'],SIZES={Small:13,Normal:16,Large:18,'Extra large':22};
 const aliases={b:'strong',i:'em',font:'span'},tags=new Set(['strong','em','u','ul','ol','li','p','div','br','span','a']);
 const escape=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 function decode(value){return String(value).replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(all,key)=>{const named={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};if(named[key.toLowerCase()]!==undefined)return named[key.toLowerCase()];const n=parseInt(key.slice(key[1]?.toLowerCase()==='x'?2:1),key[1]?.toLowerCase()==='x'?16:10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';});}
 function safeLink(value){try{const u=new URL(decode(value));return ['https:','http:','mailto:'].includes(u.protocol)&&!u.username&&!u.password&&!/[\u0000-\u0020\u007f]/.test(value)?u.href:'';}catch{return '';}}
 function style(value,face='',size=''){
  const values={};for(const declaration of String(value).split(';')){const i=declaration.indexOf(':');if(i<0)continue;values[declaration.slice(0,i).trim().toLowerCase()]=declaration.slice(i+1).trim();}
  const font=FONTS.find(f=>f.toLowerCase()===(face||values['font-family']||'').replace(/["']/g,'').split(',')[0].trim().toLowerCase());
  const px=size?({1:13,2:13,3:16,4:18,5:22,6:22,7:22})[size]:Number((values['font-size']||'').replace(/px$/,''));
  return [font?'font-family:'+font:'',Object.values(SIZES).includes(px)?'font-size:'+px+'px':'',/^(bold|[6-9]00)$/.test(values['font-weight'])?'font-weight:bold':'',values['font-style']==='italic'?'font-style:italic':'',values['text-decoration']==='underline'?'text-decoration:underline':''].filter(Boolean).join(';');
 }
 function parse(html){
  const root={children:[]},stack=[root];if(typeof html!=='string'||html.length>MAX_HTML)return root;
  const source=html.replace(/<!--[\s\S]*?(?:-->|$)/g,'').replace(/<(script|style|iframe|object|svg|math|template)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi,'');
  for(const token of source.match(/<[^>]*>|[^<]+|</g)||[]){
   if(token[0]!=='<'||token==='<'){stack.at(-1).children.push({text:decode(token)});continue;}
   const match=token.match(/^<\s*(\/?)\s*([a-z][\w-]*)/i);if(!match)continue;const tag=aliases[match[2].toLowerCase()]||match[2].toLowerCase();if(!tags.has(tag))continue;
   if(match[1]){const idx=stack.map(n=>n.tag).lastIndexOf(tag);if(idx>0)stack.length=idx;continue;}
   const attrs={};for(const a of token.matchAll(/\s([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))attrs[a[1].toLowerCase()]=decode(a[2]??a[3]??a[4]??'');
   const node={tag,children:[],style:style(attrs.style,attrs.face,attrs.size),href:tag==='a'?safeLink(attrs.href||''):''};stack.at(-1).children.push(node);if(tag!=='br'){if(stack.length>=64)return {children:[]};stack.push(node);}
  }return root;
 }
 function serialize(node){if(node.tag==='div'&&node.children.length===1&&node.children[0].tag==='div'&&node.children[0].style===node.style)return serialize(node.children[0]);if(node.text!==undefined)return escape(node.text);const body=node.children.map(serialize).join('');if(!node.tag)return body;if(node.tag==='br')return '<br>';if(node.tag==='a'&&!node.href)return body;return '<'+node.tag+(node.style?' style="'+node.style+'"':'')+(node.href?' href="'+escape(node.href)+'"':'')+'>'+body+'</'+node.tag+'>';}
 function sanitize(html){return serialize(parse(html));}
 function nodeText(node){
  if(node.text!==undefined)return node.text;if(node.tag==='br')return '\n';
  if(['div','p','li'].includes(node.tag)&&node.children.length===1&&node.children[0].tag==='br')return '';
  const block=n=>['div','p','li','ul','ol'].includes(n?.tag);let text='';
  for(let i=0;i<node.children.length;i++){const child=node.children[i],previous=node.children[i-1];if(i>0&&(block(child)||block(previous))){const count=child.tag==='p'||previous?.tag==='p'?2:1,existing=(text.match(/\n*$/)||[''])[0].length;text+='\n'.repeat(previous&&['div','p','li'].includes(previous.tag)&&previous.children.length===1&&previous.children[0].tag==='br'?count:Math.max(0,count-existing));}text+=nodeText(child);}
  return text;
 }
 function toText(html){return nodeText(parse(html));}
 function fromText(text){return escape(text).replace(/\r\n?/g,'\n').replace(/\n/g,'<br>');}
 const comparable=value=>String(value??'').replace(/\s+/g,' ').trim();
 function matchingHtml(text,html){const safe=sanitize(html);return safe&&comparable(toText(safe))===comparable(text)?safe:'';}
 function fields(text,html,key='messageHtml'){const safe=matchingHtml(text,html);return safe?{[key]:safe}:{};}
 function typography(html){const tree=parse(html);let result='';const walk=n=>{if(!result&&n.style)result=n.style.split(';').filter(s=>s.startsWith('font-family:')||s.startsWith('font-size:')).join(';');for(const c of n.children||[])walk(c);};walk(tree);return result;}
 // Replace text across inline tags without flattening emphasis around a slot.
 function substitute(html,values,{slots=false}={}){
  const tree=parse(html),leaves=[];let joined='';const walk=n=>{if(n.text!==undefined){leaves.push({node:n,start:joined.length});joined+=n.text;}for(const c of n.children||[])walk(c);};walk(tree);
  const pairs=Object.entries(values||{}).filter(([key,value])=>/^[a-zA-Z][\w]*$/.test(key)&&String(value??'').length).map(([key,value])=>[slots?String(value):'{{'+key+'}}',slots?'{{'+key+'}}':String(value)]).sort((a,b)=>b[0].length-a[0].length);
  const changes=[];for(const [needle,replacement] of pairs){let index=0;while((index=joined.indexOf(needle,index))>=0){const start=index,end=index+needle.length;if(!changes.some(c=>start<c.end&&end>c.start))changes.push({start,end,replacement,anchor:start+(slots?0:2)});index=end;}}
  for(const {node,start} of leaves){const end=start+node.text.length;let value='',cursor=0;for(const change of changes.filter(c=>c.start<end&&c.end>start).sort((a,b)=>a.start-b.start)){const from=Math.max(0,change.start-start),to=Math.min(node.text.length,change.end-start);value+=node.text.slice(cursor,from);if(change.anchor>=start&&change.anchor<end)value+=change.replacement;cursor=to;}node.text=value+node.text.slice(cursor);}
  return serialize(tree);
 }
 function reusableHtml(html,before,after,values){const replaced=matchingHtml(after,substitute(html,values,{slots:true}));return replaced||carry(html,before,after);}
 // Keep supported markup on unchanged phrases. Never reuse old HTML wording or links.
 function carry(html,before,after){
  const safe=matchingHtml(before,html);if(!safe)return '';if(before===after)return safe;
  const lists=parse(safe).children;let sole=lists.length===1?lists[0]:null;while(sole?.tag==='div'&&sole.children.length===1)sole=sole.children[0];
  if(['ul','ol'].includes(sole?.tag)&&sole.children.every(n=>n.tag==='li')){const lines=String(after).split('\n');if(lines.length===sole.children.length){const css=typography(safe),body='<'+sole.tag+'>'+lines.map(line=>'<li>'+fromText(line)+'</li>').join('')+'</'+sole.tag+'>';return css?'<div style="'+css+'">'+body+'</div>':body;}}
  let result=fromText(after);const spans=[];const walk=n=>{if(['strong','em','u','a','ul','ol'].includes(n.tag)||n.tag==='span'&&n.style){const text=nodeText(n).replace(/\n+$/,'');if(text.trim())spans.push({node:n,text});}else for(const c of n.children||[])walk(c);};walk(parse(safe));
  for(const {node,text} of spans){const needle=fromText(text);if(needle&&result.includes(needle)&&result.indexOf(needle)===result.lastIndexOf(needle))result=result.replace(needle,serialize(node));}
  const css=typography(safe);if(css)result='<div style="'+css+'">'+result+'</div>';return matchingHtml(after,result);
 }
 function validateDraftHtml(message,html,sourceHtml='',sourceText=''){if(typeof html!=='string'||html.length>MAX_HTML)throw Error('Invalid message formatting');const safe=matchingHtml(message,html);if(html&&!safe)throw Error('Formatting does not match the message');const existing=[...String(sourceText).matchAll(/https?:\/\/[^\s<>"\])]+/g)].map(m=>safeLink(m[0].replace(/[.,;!?]+$/,'')));const hrefs=value=>[...sanitize(value).matchAll(/href="([^"]*)"/g)].map(m=>decode(m[1]));const allowed=new Set([...existing,...hrefs(sourceHtml)]);if(hrefs(safe).some(url=>!allowed.has(url)))throw Error('Formatted message added an unapproved link');return safe;}
 async function copy({subject='',message='',messageHtml=''},navigator=globalThis.navigator,window=globalThis){const text=[subject,message].filter(Boolean).join('\n\n'),html=matchingHtml(message,messageHtml);if(html&&navigator?.clipboard?.write&&window.ClipboardItem&&window.Blob){await navigator.clipboard.write([new window.ClipboardItem({'text/plain':new window.Blob([text],{type:'text/plain'}),'text/html':new window.Blob([(subject?'<p>'+escape(subject)+'</p>':'')+html],{type:'text/html'})})]);return;}await navigator.clipboard.writeText(text);}
 return {MAX_HTML,FONTS,SIZES,escape,safeLink,sanitize,toText,fromText,matchingHtml,fields,typography,substitute,reusableHtml,carry,validateDraftHtml,copy};
});
