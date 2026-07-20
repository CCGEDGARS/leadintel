import {randomBytes} from "node:crypto";
import {spawnSync} from "node:child_process";

const email="edgars@ccgroup.lv";
const password=randomBytes(24).toString("base64url");

function run(command,args,{input}={}) {
  const result=spawnSync(command,args,{input,encoding:"utf8",stdio:["pipe","pipe","pipe"]});
  if(result.status!==0)throw new Error(`${command} failed: ${result.stderr.trim()||"unknown error"}`);
}

run("security",["add-generic-password","-U","-a",email,"-s","LeadIntel Backend Admin","-w",password]);
run("npx",["wrangler","secret","put","ADMIN_EMAIL"],{input:`${email}\n`});
run("npx",["wrangler","secret","put","ADMIN_PASSWORD"],{input:`${password}\n`});
console.log("Owner credentials stored in macOS Keychain and Cloudflare Worker secrets.");
