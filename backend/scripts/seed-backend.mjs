import {readFile} from "node:fs/promises";
import {spawnSync} from "node:child_process";

const api="https://leadintel-api.edgars-7e7.workers.dev";
const email="edgars@ccgroup.lv";
const keychain=spawnSync("security",["find-generic-password","-a",email,"-s","LeadIntel Backend Admin","-w"],{encoding:"utf8"});
if(keychain.status!==0)throw new Error("LeadIntel owner credential was not found in macOS Keychain");
const password=keychain.stdout.trim();
const login=await fetch(`${api}/api/login`,{method:"POST",headers:{"Content-Type":"application/json","Origin":api},body:JSON.stringify({email,password})});
if(!login.ok)throw new Error(`Backend login failed (${login.status})`);
const cookie=login.headers.get("set-cookie")?.split(";")[0];
if(!cookie)throw new Error("Backend did not issue a session cookie");
const snapshot=JSON.parse(await readFile(new URL("../seed/current-workspace.json",import.meta.url),"utf8"));
const response=await fetch(`${api}/api/snapshot?workspace_id=edgars-latvia`,{method:"POST",headers:{"Content-Type":"application/json","Origin":api,"Cookie":cookie},body:JSON.stringify(snapshot)});
if(!response.ok)throw new Error(`Snapshot seed failed (${response.status}): ${await response.text()}`);
const result=await response.json();
console.log(`Seeded ${result.opportunities} safe opportunities into the authenticated workspace.`);
