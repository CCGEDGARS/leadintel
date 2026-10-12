import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

const backendRoot=fileURLToPath(new URL('../',import.meta.url));
const migrationTable='d1_migrations';
async function run(args){
 const executable=path.join(backendRoot,'node_modules/wrangler/bin/wrangler.js');
 await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[executable,...args],{cwd:backendRoot,stdio:'inherit',env:process.env});child.on('error',reject);child.on('close',code=>code===0?resolve():reject(Error('D1 file import failed; deployment stopped')));});
}
export async function applyPendingMigrations({environment=process.env,fetchImpl=fetch,runWrangler=run,log=console.log}={}){
 const token=environment.CLOUDFLARE_API_TOKEN,account=environment.CLOUDFLARE_ACCOUNT_ID;
 if(!token||!account)throw Error('Cloudflare deployment credentials are required');
 const config=await fs.readFile(path.join(backendRoot,'wrangler.toml'),'utf8');
 const database=config.match(/database_id\s*=\s*"([^"]+)"/)?.[1],name=config.match(/database_name\s*=\s*"([^"]+)"/)?.[1];
 if(!database||!name)throw Error('D1 deployment binding is missing');
 async function query(sql){
  const response=await fetchImpl(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/d1/database/${encodeURIComponent(database)}/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({sql}),signal:AbortSignal.timeout(30000)});
  const payload=await response.json().catch(()=>null);
  if(!response.ok||!payload?.success||payload.result?.some(r=>!r.success))throw Error(`D1 migration metadata request failed (${response.status}); deployment stopped`);
  return payload.result?.flatMap(r=>r.results||[])||[];
 }
 await query(`CREATE TABLE IF NOT EXISTS ${migrationTable} (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT UNIQUE,applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)`);
 const rows=await query(`SELECT name FROM ${migrationTable} ORDER BY id`),applied=new Set(rows.map(row=>row.name));
 const directory=path.join(backendRoot,'migrations'),files=(await fs.readdir(directory)).filter(n=>/^\d+_[A-Za-z0-9_-]+\.sql$/.test(n)).sort();
 const pending=files.filter(name=>!applied.has(name));log(`Pending D1 migrations: ${pending.length}`);
 for(const migration of pending){
  const source=await fs.readFile(path.join(directory,migration),'utf8');
  const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'leadintel-d1-migration-'));
  try{
   const file=path.join(temporary,migration);
   // The native file-import operation rolls back the whole file on failure.
   // Its completion marker belongs in that same file, never in a later query.
   await fs.writeFile(file,source+`\nINSERT INTO ${migrationTable}(name) VALUES('${migration}');\n`,{mode:0o600});
   log(`Applying D1 migration: ${migration}`);
   await runWrangler(['d1','execute',name,'--remote','--file',file,'--yes']);
   const confirmation=await query(`SELECT name FROM ${migrationTable} WHERE name='${migration}'`);
   if(confirmation.length!==1)throw Error('D1 migration completion was not confirmed; deployment stopped');
  }finally{await fs.rm(temporary,{recursive:true,force:true});}
 }
 return pending;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))applyPendingMigrations().catch(error=>{console.error(error.message);process.exitCode=1;});
