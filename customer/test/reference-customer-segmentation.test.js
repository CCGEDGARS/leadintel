const test=require('node:test');
const assert=require('node:assert/strict');
const Ref=require('../reference-customers.js');

test('minimal reference customer import only requires company name and website',()=>{
  const rows=Ref.normalizeImportedRows([
    {'Company Name':'Acme','Website':'https://acme.example'},
    {'Company Name':'Beta','Website':'beta.example'}
  ],{sourceType:'csv'});
  assert.equal(rows.length,2);
  assert.equal(rows[0].status,'ready');
  assert.equal(rows[1].domain,'beta.example');
});

test('analysis can classify reference customers into meaningful segments',()=>{
  const rows=Ref.normalizeImportedRows([
    {Company:'Factory A',Website:'https://factory-a.example'},
    {Company:'Factory B',Website:'https://factory-b.example'},
    {Company:'SaaS A',Website:'https://saas-a.example'},
    {Company:'SaaS B',Website:'https://saas-b.example'}
  ],{sourceType:'csv'});
  const analyses={
    [rows[0].id]:{industry:'industrial manufacturing',businessModel:'B2B',sizeBand:'100-500',buyerRoles:['Operations'],confidence:'high'},
    [rows[1].id]:{industry:'industrial manufacturing',businessModel:'B2B',sizeBand:'100-500',buyerRoles:['Plant Manager'],confidence:'high'},
    [rows[2].id]:{industry:'software / technology',businessModel:'B2B',sizeBand:'50-100',buyerRoles:['CEO'],confidence:'high'},
    [rows[3].id]:{industry:'software / technology',businessModel:'B2B',sizeBand:'50-100',buyerRoles:['CEO'],confidence:'high'}
  };
  const segmentation=Ref.buildReferenceSegments(rows,analyses);
  assert.equal(segmentation.meaningful,true);
  assert.equal(segmentation.segments.length,2);
  assert.ok(segmentation.segments.every(segment=>segment.rowIds.length>=2));
});

test('coherent customer list stays one group instead of inventing segments',()=>{
  const rows=Ref.normalizeImportedRows([
    {Company:'Factory A',Website:'https://factory-a.example'},
    {Company:'Factory B',Website:'https://factory-b.example'},
    {Company:'Factory C',Website:'https://factory-c.example'}
  ],{sourceType:'csv'});
  const analyses=Object.fromEntries(rows.map(row=>[row.id,{industry:'industrial manufacturing',businessModel:'B2B',sizeBand:'100-500',confidence:'high'}]));
  const segmentation=Ref.buildReferenceSegments(rows,analyses);
  assert.equal(segmentation.meaningful,false);
  assert.equal(segmentation.segments.length,1);
});

test('activation can use selected AI segments as the priority model',()=>{
  const rows=Ref.normalizeImportedRows([
    {Company:'Factory A',Website:'https://factory-a.example'},
    {Company:'Factory B',Website:'https://factory-b.example'},
    {Company:'SaaS A',Website:'https://saas-a.example'},
    {Company:'SaaS B',Website:'https://saas-b.example'}
  ],{sourceType:'csv'});
  const segments=[
    {id:'segment-industrial',name:'Industrial manufacturing',rowIds:[rows[0].id,rows[1].id]},
    {id:'segment-software',name:'Software / technology',rowIds:[rows[2].id,rows[3].id]}
  ];
  const active=Ref.activateReferenceSegments({rows,segments},['segment-industrial']);
  assert.equal(active.activated,true);
  assert.deepEqual(active.activeSegmentIds,['segment-industrial']);
  assert.deepEqual(new Set(active.activeIds),new Set([rows[0].id,rows[1].id]));
});
