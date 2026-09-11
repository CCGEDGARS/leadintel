(function(root,factory){
  const base=(typeof module!=="undefined"&&module.exports)?require('./reference-customers.js'):root.LeadIntelReferenceCustomers;
  const api=factory(base||{});
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root){
    root.LeadIntelReferenceCustomerTableDetection=api;
    if(root.LeadIntelReferenceCustomers)Object.assign(root.LeadIntelReferenceCustomers,api);
  }
})(typeof globalThis!=="undefined"?globalThis:this,function(Ref){
  'use strict';
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[_./\\-]+/g,' ').replace(/\s+/g,' ').trim();
  const companyAliases=new Set(['company','company name','customer','customer name','client','client name','uznemums','uznemuma nosaukums','klients','klienta uznemums','name']);
  const websiteAliases=new Set(['website','web','web site','site','url','domain','homepage','majaslapa','majas lapa','interneta adrese']);
  const looksLikeWebsite=value=>{const v=clean(value);return /^(?:https?:\/\/|www\.)/i.test(v)||/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(?:[\/:?#]|$)/i.test(v);};
  const looksLikeId=value=>/^(?:co|id|cust|client)?\s*\d{2,}$/i.test(clean(value));

  function rowToObject(headers,row){
    const out={};
    headers.forEach((header,index)=>{const key=clean(header)||`Column ${index+1}`;out[key]=clean(row?.[index]);});
    return out;
  }

  function candidateForSheet(sheet){
    const rows=Array.isArray(sheet?.rows)?sheet.rows:[];
    let best=null;
    for(let headerRowIndex=0;headerRowIndex<Math.min(rows.length,20);headerRowIndex++){
      const header=(rows[headerRowIndex]||[]).map(clean);
      if(!header.some(Boolean))continue;
      const normalized=header.map(norm);
      let companyCol=normalized.findIndex(value=>companyAliases.has(value));
      let websiteCol=normalized.findIndex(value=>websiteAliases.has(value));
      const data=rows.slice(headerRowIndex+1).filter(row=>Array.isArray(row)&&row.some(cell=>clean(cell)));
      if(!data.length)continue;

      const width=Math.max(header.length,...data.slice(0,50).map(row=>row.length||0));
      const websiteCounts=Array.from({length:width},(_,col)=>data.slice(0,80).filter(row=>looksLikeWebsite(row?.[col])).length);
      const textCounts=Array.from({length:width},(_,col)=>data.slice(0,80).filter(row=>{const v=clean(row?.[col]);return v&&!looksLikeWebsite(v)&&!looksLikeId(v);}).length);
      if(websiteCol<0){const max=Math.max(...websiteCounts,0);if(max>=2)websiteCol=websiteCounts.indexOf(max);}
      if(companyCol<0){
        const candidates=textCounts.map((count,col)=>({col,count})).filter(x=>x.col!==websiteCol).sort((a,b)=>b.count-a.count);
        if(candidates[0]?.count>=2)companyCol=candidates[0].col;
      }

      const recognizedCompany=normalized.some(value=>companyAliases.has(value));
      const recognizedWebsite=normalized.some(value=>websiteAliases.has(value));
      const websiteHits=websiteCol>=0?websiteCounts[websiteCol]||0:0;
      const companyHits=companyCol>=0?textCounts[companyCol]||0:0;
      let score=(recognizedCompany?16:0)+(recognizedWebsite?8:0)+Math.min(websiteHits,10)*2+Math.min(companyHits,10);
      if(recognizedCompany&&recognizedWebsite)score+=8;
      if(headerRowIndex<=3)score+=3;
      if(/compan|customer|client|uznem/i.test(clean(sheet.name)))score+=4;
      if(/contact/i.test(clean(sheet.name)))score-=5;
      if(companyCol<0&&websiteCol<0)score-=25;
      if(!best||score>best.score)best={score,headerRowIndex,header,companyCol,websiteCol,data};
    }
    if(!best||best.score<8||(best.companyCol<0&&best.websiteCol<0))return null;
    const headers=best.header.map((value,index)=>value||`Column ${index+1}`);
    if(best.companyCol>=0&&!companyAliases.has(norm(headers[best.companyCol])))headers[best.companyCol]='Company Name';
    if(best.websiteCol>=0&&!websiteAliases.has(norm(headers[best.websiteCol])))headers[best.websiteCol]='Website';
    const objects=best.data.map(row=>rowToObject(headers,row)).filter(row=>Object.values(row).some(Boolean));
    return {sheetName:clean(sheet.name)||'Sheet',headerRowIndex:best.headerRowIndex,rows:objects,score:best.score};
  }

  function detectCustomerTable(sheets=[]){
    const candidates=(sheets||[]).map(candidateForSheet).filter(Boolean).sort((a,b)=>b.score-a.score||b.rows.length-a.rows.length);
    return candidates[0]||{sheetName:'',headerRowIndex:-1,rows:[],score:0};
  }

  return {detectCustomerTable};
});
