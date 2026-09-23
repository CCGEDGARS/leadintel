const SMART_REFERENCE_STORAGE_KEY='leadintel_customer_v2_state';
const SMART_XLSX_VERSION='0.18.5';

(function installSmartReferenceImport(root){
  if(typeof document==='undefined')return;
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  function readState(){try{return JSON.parse(localStorage.getItem(SMART_REFERENCE_STORAGE_KEY)||'{}');}catch{return {};}}
  function writeState(state){
    const Ref=root.LeadIntelReferenceCustomers;
    if(Ref?.persistReferenceWorkspaceState)return Ref.persistReferenceWorkspaceState(root,state,{render:true});
    localStorage.setItem(SMART_REFERENCE_STORAGE_KEY,JSON.stringify(state));
    root.dispatchEvent(new CustomEvent('leadintel:reference-customers-updated'));
    root.LeadIntelReferenceCustomerUI?.render?.();
    try{const pending=root.LeadIntelServerBridge?.saveNow?.();if(pending&&typeof pending.then==='function')void Promise.resolve(pending).catch(()=>null);}catch{}
    return state;
  }
  function setStatus(message){const node=document.getElementById('reference-import-status');if(node)node.textContent=message;}
  function mergeRows(Ref,state,newRows,source){
    const current=Ref.normalizeReferenceState(state.referenceCustomers||{});
    const combined=Ref.normalizeImportedRows([
      ...current.rows.map(row=>({Company:row.companyName,Website:row.website,Country:row.country,Product:row.productService,Value:row.approximateValue,'Why good':row.reason,Notes:row.notes})),
      ...newRows.map(row=>({Company:row.companyName,Website:row.website,Country:row.country,Product:row.productService,Value:row.approximateValue,'Why good':row.reason,Notes:row.notes}))
    ],{sourceType:'state'});
    const incomingByKey=new Map(newRows.map(row=>[row.domain||`n:${clean(row.companyName).toLowerCase()}`,row]));
    state.referenceCustomers=Ref.normalizeReferenceState({...current,source,rows:combined.map(row=>{
      const incoming=incomingByKey.get(row.domain)||incomingByKey.get(`n:${clean(row.companyName).toLowerCase()}`);
      return incoming?{...row,status:incoming.status,reviewed:incoming.reviewed}:row;
    }),segments:[],activeSegmentIds:[],activeIds:[],activated:false,dna:null});
    return state;
  }
  async function importExcel(file,mode='new'){
    const Ref=root.LeadIntelReferenceCustomers;
    const detector=root.LeadIntelReferenceCustomerTableDetection?.detectCustomerTable||Ref?.detectCustomerTable;
    if(!Ref?.normalizeImportedRows)throw new Error('Reference customer importer is not ready. Reload and try again.');
    if(typeof detector!=='function')throw new Error('Customer table detector failed to load. Reload and try again.');
    setStatus('Reading workbook and finding the customer table…');
    const XLSX=await import(`https://cdn.jsdelivr.net/npm/xlsx@${SMART_XLSX_VERSION}/+esm`);
    const workbook=XLSX.read(await file.arrayBuffer(),{type:'array'});
    const sheets=workbook.SheetNames.map(name=>({name,rows:XLSX.utils.sheet_to_json(workbook.Sheets[name],{header:1,defval:'',raw:false})}));
    const detected=detector(sheets);
    if(!detected.rows.length)throw new Error('I could not identify a customer table in this workbook.');
    const rows=Ref.normalizeImportedRows(detected.rows,{sourceType:'xlsx'});
    if(!rows.length)throw new Error(`I found the “${detected.sheetName}” table but could not identify company rows.`);
    let state=readState();
    if(mode!=='append'){
      const Portfolio=root.LeadIntelReferenceCustomerPortfolio;
      if(!Portfolio?.newList)throw new Error('Reference Customer portfolio is unavailable');
      state=Portfolio.newList(state);
    }
    mergeRows(Ref,state,rows,{type:'xlsx',name:file.name||'Customer workbook',sheet:detected.sheetName,headerRow:detected.headerRowIndex+1});
    await writeState(state);
    const ready=rows.filter(row=>row.status==='ready').length;
    const missing=rows.length-ready;
    setStatus(`${rows.length} companies imported from “${detected.sheetName}”. ${ready} have websites ready for analysis${missing?` · ${missing} need website enrichment`:''}.`);
    root.LeadIntelReferenceCustomerUI?.render?.();
  }
  document.addEventListener('change',event=>{
    const input=event.target;
    if(!(input instanceof HTMLInputElement)||input.id!=='reference-file-input')return;
    const file=input.files?.[0];
    if(!file)return;
    const ext=(file.name.split('.').pop()||'').toLowerCase();
    if(ext!=='xlsx'&&ext!=='xls')return;
    const mode=root.LeadIntelReferenceCustomerUploadMode?.consumeImportMode?.()||'new';
    event.stopImmediatePropagation();
    importExcel(file,mode).catch(error=>setStatus(error?.message||'Unable to import customer workbook')).finally(()=>{input.value='';});
  },true);
})(globalThis);
