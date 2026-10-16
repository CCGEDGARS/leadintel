// Regenerate backend email seeds from the one canonical frontend source.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),A=require(path.join(root,'customer/approved-reference-scripts.js'));
const filename=path.join(root,'backend/src/core-script-seeds.js'),source=fs.readFileSync(filename,'utf8');
const records=JSON.parse(source.slice(source.indexOf('['),source.lastIndexOf(']')+1));
for(const row of records.filter(row=>row.channel==='email')){
 const oldBody=row.body;
 row.body=A.approvedPattern(row.style);row.original=A.originalText(row.style);row.masterVersion='20261015-v2';
 row.previousBuiltinBodies=[...new Set([...(row.previousBuiltinBodies||[]),oldBody])].filter(body=>body!==row.body);
}
fs.writeFileSync(filename,'// Generated email rows: node scripts/sync-email-core-masters.cjs\nexport const coreScriptSeeds = '+JSON.stringify(records,null,2)+';\n');
