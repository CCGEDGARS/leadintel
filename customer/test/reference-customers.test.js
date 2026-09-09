const test=require('node:test');
const assert=require('node:assert/strict');
const Ref=require('../reference-customers.js');
Object.assign(Ref,require('../reference-customer-table-detection.js'));

test('CSV import normalizes common customer-list headers and deduplicates companies',()=>{
  const csv='Company,Website,Country,Product,Value,Why good\n"Acme, SIA",https://acme.lv,Latvia,Training,12000,Strong fit\nAcme duplicate,https://www.acme.lv,Latvia,Training,12000,Duplicate\nBeta,beta.eu,Germany,AI,25000,Growth';
  const rows=Ref.parseCsv(csv);
  const normalized=Ref.normalizeImportedRows(rows,{sourceType:'csv'});
  assert.equal(normalized.length,2);
  assert.equal(normalized[0].companyName,'Acme, SIA');
  assert.equal(normalized[0].domain,'acme.lv');
  assert.equal(normalized[1].country,'Germany');
});

test('CSV import accepts tab-separated files and Latvian/common header variants',()=>{
  const csv='Uzņēmuma nosaukums\tMājas lapa\nAcme SIA\thttps://acme.lv\nBeta SIA\tbeta.lv';
  const rows=Ref.parseCsv(csv);
  const normalized=Ref.normalizeImportedRows(rows,{sourceType:'csv'});
  assert.equal(normalized.length,2);
  assert.equal(normalized[0].companyName,'Acme SIA');
  assert.equal(normalized[0].domain,'acme.lv');
  assert.equal(normalized[1].domain,'beta.lv');
});

test('reference import falls back to first populated column plus URL-like value when headers are unfamiliar',()=>{
  const rows=[{'Klienta uzņēmums':'Acme SIA','Interneta adrese':'https://acme.lv'},{'Klienta uzņēmums':'Beta SIA','Interneta adrese':'beta.lv'}];
  const normalized=Ref.normalizeImportedRows(rows,{sourceType:'csv'});
  assert.equal(normalized.length,2);
  assert.equal(normalized[0].companyName,'Acme SIA');
  assert.equal(normalized[0].domain,'acme.lv');
  assert.equal(normalized[1].companyName,'Beta SIA');
});

test('Excel table detection skips title rows and chooses the sheet with customer data',()=>{
  const sheets=[
    {name:'Contacts',rows:[['LEAD INTEL — Contacts Database'],['Company ID','Company Name','First Name','Last Name'],['CO001','IKEA','Ilze','Vītiņa']]},
    {name:'Companies',rows:[['LEAD INTEL — Company Master List'],['ID','Company Name','Industry','Size','Country','Website','Company LinkedIn'],['CO001','IKEA','Retail','Large','Latvia','https://www.ikea.com/lv','https://linkedin.com/company/ikea'],['CO002','Coca-Cola','FMCG','Large','Latvia','https://www.coca-cola.com','']]},
    {name:'ICP Guide',rows:[['LEAD INTEL — ICP & Usage Guide'],[],['Primary Industries','Finance · IT · Logistics']]}
  ];
  const detected=Ref.detectCustomerTable(sheets);
  assert.equal(detected.sheetName,'Companies');
  assert.equal(detected.headerRowIndex,1);
  assert.equal(detected.rows.length,2);
  const normalized=Ref.normalizeImportedRows(detected.rows,{sourceType:'xlsx'});
  assert.equal(normalized[0].companyName,'IKEA');
  assert.equal(normalized[0].domain,'ikea.com');
  assert.equal(normalized[1].companyName,'Coca-Cola');
});

test('unsafe or missing websites remain unresolved instead of being guessed',()=>{
  const rows=Ref.normalizeImportedRows([{Company:'Gamma',Website:'javascript:alert(1)',Country:'Sweden'},{Company:'Delta',Country:'Sweden'}],{sourceType:'csv'});
  assert.equal(rows[0].website,'');
  assert.equal(rows[0].status,'unresolved');
  assert.equal(rows[1].status,'unresolved');
});

test('PDF-derived rows require review before activation',()=>{
  const rows=Ref.normalizeImportedRows([{Company:'PDF Company',Website:'https://pdfco.com'}],{sourceType:'pdf'});
  assert.equal(rows[0].status,'needs_review');
  const state=Ref.normalizeReferenceState({rows,activeIds:[rows[0].id],activated:true});
  assert.deepEqual(state.activeIds,[]);
});

test('imported reference list is inert until explicitly activated',()=>{
  const rows=Ref.normalizeImportedRows([{Company:'Acme',Website:'https://acme.com'},{Company:'Beta',Website:'https://beta.com'}],{sourceType:'csv'});
  const state=Ref.normalizeReferenceState({rows});
  assert.equal(Ref.getActiveReferenceModel(state),null);
  const active=Ref.activateReferenceCustomers(state,rows.map(r=>r.id));
  assert.equal(active.activated,true);
  assert.equal(Ref.getActiveReferenceModel(active).activeRows.length,2);
});

test('active reference model is bounded and carries a stable fingerprint',()=>{
  const rows=Ref.normalizeImportedRows(Array.from({length:60},(_,i)=>({Company:`Company ${i}`,Website:`https://c${i}.example`})),{sourceType:'csv'});
  const active=Ref.activateReferenceCustomers({rows},rows.map(r=>r.id));
  assert.ok(active.activeIds.length<=50);
  assert.match(active.fingerprint,/^[a-z0-9-]+$/);
});

test('DNA builder summarizes only evidenced active customer traits',()=>{
  const rows=Ref.normalizeImportedRows([{Company:'A',Website:'https://a.example'},{Company:'B',Website:'https://b.example'}],{sourceType:'csv'});
  const active=Ref.activateReferenceCustomers({rows},rows.map(r=>r.id));
  const analyses={
    [rows[0].id]:{industry:'industrial manufacturing',sizeBand:'100-500',businessModel:'B2B',buyerRoles:['COO'],confidence:'high'},
    [rows[1].id]:{industry:'industrial manufacturing',sizeBand:'100-500',businessModel:'B2B',buyerRoles:['Plant Manager'],confidence:'medium'}
  };
  const dna=Ref.buildReferenceDna(active,analyses);
  assert.equal(dna.activeCount,2);
  assert.ok(dna.dimensions.some(d=>d.key==='industry'&&d.values.includes('industrial manufacturing')));
  assert.ok(['high','medium','low'].includes(dna.confidence));
});
