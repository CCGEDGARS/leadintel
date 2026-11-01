// Harvey-inspired public-address decoding. This exposes a published listing,
// never identity, current employment, mailbox deliverability or send permission.
const ADDRESS=/^[a-z0-9._%+-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i;
function address(value){return value.length<=254&&ADDRESS.test(value)&&!value.includes('..')?value:'';}
function cfAddress(hex){
  if(!/^(?:[a-f0-9]{2}){4,255}$/i.test(hex))return '';
  const key=parseInt(hex.slice(0,2),16);let decoded='';
  for(let i=2;i<hex.length;i+=2)decoded+=String.fromCharCode(parseInt(hex.slice(i,i+2),16)^key);
  return address(decoded);
}
export function exposePublishedEmailHtml(html){
  // Run after removing scripts/comments. Read quoted attributes on one element
  // only; never join an unrelated user's name with another element's domain.
  return String(html||'').replace(/<[a-z][^<>]*>/gi,tag=>{
    const attrs=new Map();
    for(const match of tag.matchAll(/\s([a-z][a-z0-9-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)){
      const name=match[1].toLowerCase();if(attrs.has(name))return tag;
      attrs.set(name,match[2]??match[3]);
    }
    const protectedLink=attrs.get('href')?.match(/^\/cdn-cgi\/l\/email-protection#([a-f0-9]+)$/i);
    let email=cfAddress(attrs.get('data-cfemail')||protectedLink?.[1]||'');
    if(!email&&attrs.has('data-user')&&attrs.has('data-domain'))email=address(attrs.get('data-user')+'@'+attrs.get('data-domain'));
    return email?tag+email+' ':tag;
  });
}
