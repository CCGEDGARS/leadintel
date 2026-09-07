const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'../..');
const vercel=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
const pkg=fs.existsSync(path.join(root,'package.json'))?JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')):{};

test('Vercel build explicitly packages the safe static artifact and Scrapling Python function',()=>{
  assert.ok(Array.isArray(vercel.builds),'mixed static/function deployment must use an explicit build allowlist');
  assert.ok(vercel.builds.some(item=>item.src==='package.json'&&item.use==='@vercel/static-build'&&item.config?.distDir==='.vercel-static'));
  assert.ok(vercel.builds.some(item=>item.src==='api/scrapling.py'&&item.use==='@vercel/python'));
  assert.equal(pkg.scripts?.build,'bash scripts/build-vercel-static.sh');
});

test('Vercel routes Scrapling to the Python function before the static catch-all',()=>{
  assert.ok(Array.isArray(vercel.routes));
  const apiIndex=vercel.routes.findIndex(route=>route.src==='/api/scrapling'&&route.dest==='/api/scrapling.py');
  const staticIndex=vercel.routes.findIndex(route=>route.src==='/.*'||route.src==='/(.*)');
  assert.ok(apiIndex>=0,'Scrapling route must exist');
  assert.ok(staticIndex<0||apiIndex<staticIndex,'Scrapling route must be evaluated before static catch-all');
});
