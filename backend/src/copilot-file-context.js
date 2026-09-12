const MAX_CONTEXT_CHARS=250000;
const hasContent=block=>Boolean(block.text?.trim()||block.table?.some(row=>row.some(cell=>cell.trim())));
const size=value=>JSON.stringify(value).length;

function prefixThatFits(value,build,limit){
  let low=0,high=value.length;
  while(low<high){const middle=Math.ceil((low+high)/2);if(size(build(value.slice(0,middle)))<=limit)low=middle;else high=middle-1;}
  return value.slice(0,low);
}

function boundedBlock(block,limit){
  if(size(block)<=limit)return structuredClone(block);
  const selected={locator:block.locator};
  if(block.text)selected.text=prefixThatFits(block.text,text=>({...selected,text}),limit);
  if(block.table){
    const table=prefixThatFits(block.table,table=>({...selected,table}),limit);
    if(table.length<block.table.length){
      const next=block.table[table.length],row=prefixThatFits(next,row=>({...selected,table:[...table,row]}),limit);
      if(row.length<next.length){const cell=prefixThatFits(next[row.length],cell=>({...selected,table:[...table,[...row,cell]]}),limit);if(cell)row.push(cell);}
      if(row.length)table.push(row);
    }
    if(table.length)selected.table=table;
  }
  return size(selected)<=limit&&hasContent(selected)?selected:null;
}

// This returns data only. Callers must keep every source field out of system instructions.
export function selectRelevantFileBlocks({request,extraction,maxChars=60000,preferredLocators=[],currentRequest=''}){
  const budget=Math.max(2,Math.min(MAX_CONTEXT_CHARS,Number.isFinite(maxChars)?Math.floor(maxChars):60000));
  const terms=[...new Set(String(request||'').toLowerCase().match(/[\p{L}\p{N}]+/gu)||[])];
  const currentTerms=[...new Set(String(currentRequest).toLowerCase().match(/[\p{L}\p{N}]+/gu)||[])];
  const warnings=[...(extraction.warnings||[])],omitted=[...(extraction.coverage?.omitted||[])];
  const preferred=new Set(preferredLocators.slice(0,1000));
  const candidates=extraction.blocks.map((block,index)=>{
    const searchable=[block.locator,extraction.evidenceIndex[block.locator],block.text,...(block.table||[]).flat()].join(' ').toLowerCase();
    return {block,index,preferred:preferred.has(block.locator),currentScore:currentTerms.reduce((score,term)=>score+(searchable.includes(term)?1:0),0),score:terms.reduce((score,term)=>score+(searchable.includes(term)?1:0),0)};
  }).sort((a,b)=>Number(b.preferred)-Number(a.preferred)||b.currentScore-a.currentScore||b.score-a.score||a.index-b.index);
  // Historical citations retain priority, but cannot consume the budget needed
  // for the current question. Reserve actual current-source cost up to half the
  // total budget, leaving both topics usable even when both blocks are oversized.
  const currentCost=candidates.filter(item=>!item.preferred&&item.currentScore>0&&Object.hasOwn(extraction.evidenceIndex,item.block.locator)&&hasContent(item.block)).reduce((sum,item)=>sum+size(item.block)+1,0);
  let currentReserve=Math.min(Math.floor((budget-2)/2),currentCost);
  const blocks=[],evidenceIndex={};let remaining=budget-2;
  for(const {block,preferred:historical,currentScore} of candidates){
    if(!Object.hasOwn(extraction.evidenceIndex,block.locator)||!hasContent(block))continue;
    const selected=boundedBlock(block,remaining-(historical?currentReserve:0)-(blocks.length?1:0));
    if(selected){const used=size(selected)+(blocks.length?1:0);remaining-=used;if(!historical&&currentScore>0)currentReserve=Math.max(0,currentReserve-used);blocks.push(selected);Object.defineProperty(evidenceIndex,block.locator,{value:extraction.evidenceIndex[block.locator],enumerable:true});}
    if(!selected||size(selected)<size(block))omitted.push(`${block.locator}: ${selected?'partially included':'omitted'} from model context (context limit).`);
  }
  if(omitted.length>(extraction.coverage?.omitted||[]).length)warnings.push('Some source content was omitted from model context; consult the coverage report.');
  if(extraction.coverage?.complete!==true&&!warnings.length&&!omitted.length)warnings.push('Source extraction coverage is incomplete; some file content may be unavailable.');
  return {blocks,evidenceIndex,warnings,coverage:{complete:extraction.coverage?.complete===true&&omitted.length===0,omitted}};
}
