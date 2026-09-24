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

test('coherent reference companies produce a named, evidence-based profile rather than a generic group',()=>{
  const rows=Ref.normalizeImportedRows([
    {Company:'Factory A',Website:'https://factory-a.example'},
    {Company:'Factory B',Website:'https://factory-b.example'},
    {Company:'Factory C',Website:'https://factory-c.example'},
    {Company:'Factory D',Website:'https://factory-d.example'},
    {Company:'Factory E',Website:'https://factory-e.example'}
  ],{sourceType:'csv'});
  const analyses=Object.fromEntries(rows.map(row=>[row.id,{
    industry:'industrial manufacturing',businessModel:'B2B',sizeBand:'100-500',
    customerOutcome:'reliable production capacity',confidence:'high'
  }]));

  const result=Ref.buildReferenceSegments(rows,analyses);

  assert.equal(result.meaningful,false);
  assert.equal(result.segments[0].name,'Industrial manufacturing customers');
  assert.equal(result.segments[0].confidence,'high');
  assert.match(result.segments[0].summary,/4 recurring commercial dimensions/i);
  assert.ok(result.segments[0].traits.some(trait=>/industry: industrial manufacturing \(5\/5\)/i.test(trait)));
  assert.ok(result.segments[0].traits.some(trait=>/B2B/.test(trait)));
});

test('five high-confidence company analyses do not create a high-confidence profile without repeated traits',()=>{
  const rows=Ref.normalizeImportedRows(Array.from({length:5},(_,i)=>({Company:`Reference ${i+1}`,Website:`https://reference-${i+1}.example`})),{sourceType:'csv'});
  const analyses=Object.fromEntries(rows.map((row,index)=>[row.id,{
    industry:`industry ${index+1}`,businessModel:`model ${index+1}`,customerOutcome:`outcome ${index+1}`,confidence:'high'
  }]));

  const result=Ref.buildReferenceSegments(rows,analyses);
  const profile=result.segments[0];

  assert.equal(profile.confidence,'low');
  assert.equal(profile.recurringDimensionCount,0);
  assert.equal(profile.canActivate,false);
  assert.match(profile.summary,/No recurring commercial traits/i);
  assert.doesNotMatch(profile.summary,/shared traits/i);
  assert.ok(profile.traits.every(trait=>/\(1\/5\)/.test(trait)));
});

test('profile confidence reflects repeated traits while one-off traits remain review evidence',()=>{
  const rows=Ref.normalizeImportedRows(Array.from({length:5},(_,i)=>({Company:`Reference ${i+1}`,Website:`https://reference-${i+1}.example`})),{sourceType:'csv'});
  const analyses=Object.fromEntries(rows.map((row,index)=>[row.id,{
    industry:index<4?'industrial equipment':`other industry ${index+1}`,
    sizeBand:index<4?'500+':`size ${index+1}`,
    businessModel:`unique model ${index+1}`,
    confidence:'high'
  }]));

  const profile=Ref.buildReferenceSegments(rows,analyses).segments[0];

  assert.equal(profile.confidence,'high');
  assert.equal(profile.recurringDimensionCount,2);
  assert.equal(profile.canActivate,true);
  assert.ok(profile.traits.some(trait=>/industry: industrial equipment \(4\/5\)/i.test(trait)));
  assert.ok(profile.traits.some(trait=>/business model: unique model 1 \(1\/5\)/i.test(trait)));
  assert.match(profile.summary,/2 recurring commercial dimensions/i);
});

test('normalizing AI-proposed segments recalculates confidence from cross-company agreement',()=>{
  const rows=Ref.normalizeImportedRows(Array.from({length:5},(_,i)=>({Company:`Reference ${i+1}`,Website:`https://reference-${i+1}.example`})),{sourceType:'csv'});
  const analyses=Object.fromEntries(rows.map((row,index)=>[row.id,{
    industry:`industry ${index+1}`,businessModel:`model ${index+1}`,confidence:'high'
  }]));
  const normalized=Ref.normalizeReferenceState({rows,analyses,segments:[{
    id:'ai-profile',name:'Industrial equipment customers',rowIds:rows.map(row=>row.id),confidence:'high',summary:'AI said high confidence',traits:['Industrial equipment']
  }]});

  assert.equal(normalized.segments[0].confidence,'low');
  assert.equal(normalized.segments[0].recurringDimensionCount,0);
  assert.match(normalized.segments[0].summary,/No recurring commercial traits/i);
  assert.doesNotMatch(normalized.segments[0].summary,/AI said high confidence/i);
});

test('activated DNA excludes one-off values from multi-company lookalike dimensions',()=>{
  const rows=Ref.normalizeImportedRows(Array.from({length:5},(_,i)=>({Company:`Reference ${i+1}`,Website:`https://reference-${i+1}.example`})),{sourceType:'csv'});
  const analyses=Object.fromEntries(rows.map((row,index)=>[row.id,{
    industry:`industry ${index+1}`,businessModel:`model ${index+1}`,
    sizeBand:index<4?'500+':`size ${index+1}`,customerOutcome:index<4?'reliable delivery':`outcome ${index+1}`,confidence:'high'
  }]));
  const segmentation=Ref.buildReferenceSegments(rows,analyses);
  const state=Ref.activateReferenceSegments({rows,analyses,...segmentation},[segmentation.segments[0].id]);
  const dna=Ref.buildReferenceDna(state,analyses);

  assert.equal(dna.profileConfidence,'high');
  assert.ok(dna.dimensions.some(dimension=>dimension.key==='sizeBand'&&dimension.values.includes('500+')&&dimension.evidenceCount===4));
  assert.ok(dna.dimensions.some(dimension=>dimension.key==='customerOutcome'&&dimension.values.includes('reliable delivery')));
  assert.equal(dna.dimensions.some(dimension=>dimension.key==='industry'),false);
  assert.equal(dna.dimensions.some(dimension=>dimension.key==='businessModel'),false);
});

test('a single reference company yields a clearly marked low-confidence profile hypothesis',()=>{
  const rows=Ref.normalizeImportedRows([{Company:'Factory A',Website:'https://factory-a.example'}],{sourceType:'csv'});
  const result=Ref.buildReferenceSegments(rows,{
    [rows[0].id]:{industry:'industrial manufacturing',businessModel:'B2B',confidence:'high'}
  });

  assert.equal(result.segments[0].name,'Hypothesis: industrial manufacturing');
  assert.equal(result.segments[0].confidence,'low');
  assert.match(result.segments[0].summary,/1 reference company/i);
});

test('a segment of only two references cannot claim high confidence after normalization',()=>{
  const rows=Ref.normalizeImportedRows([
    {Company:'Factory A',Website:'https://factory-a.example'},
    {Company:'Factory B',Website:'https://factory-b.example'}
  ],{sourceType:'csv'});
  const normalized=Ref.normalizeReferenceState({rows,segments:[{
    id:'small-segment',name:'Industrial manufacturers',rowIds:rows.map(row=>row.id),confidence:'high'
  }]});

  assert.equal(normalized.segments[0].confidence,'medium');
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

test('activated reference DNA retains the approved customer profile for discovery',()=>{
  const rows=Ref.normalizeImportedRows([
    {Company:'Factory A',Website:'https://factory-a.example'},
    {Company:'Factory B',Website:'https://factory-b.example'},
    {Company:'Factory C',Website:'https://factory-c.example'},
    {Company:'Factory D',Website:'https://factory-d.example'}
  ],{sourceType:'csv'});
  const analyses=Object.fromEntries(rows.map(row=>[row.id,{industry:'industrial manufacturing',businessModel:'B2B',confidence:'high'}]));
  const segmentation=Ref.buildReferenceSegments(rows,analyses);
  const activated=Ref.activateReferenceSegments({rows,analyses,...segmentation},[segmentation.segments[0].id]);
  const dna=Ref.buildReferenceDna(activated,analyses);

  assert.equal(dna.profileName,'Industrial manufacturing customers');
  assert.equal(dna.sampleSize,4);
  assert.equal(dna.profileConfidence,'high');
});
