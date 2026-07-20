import {spawnSync} from "node:child_process";

const api="https://leadintel-api.edgars-7e7.workers.dev";
const email="edgars@ccgroup.lv";
const password=spawnSync("security",["find-generic-password","-a",email,"-s","LeadIntel Backend Admin","-w"],{encoding:"utf8"}).stdout.trim();
const health=await fetch(`${api}/api/health`).then(response=>response.json());
if(health.status!=="ok")throw new Error("Health check failed");
const html=await fetch(api).then(response=>response.text());
if(!html.includes("Secure backend access"))throw new Error("Deployed application assets are stale");
const login=await fetch(`${api}/api/login`,{method:"POST",headers:{"Content-Type":"application/json","Origin":api},body:JSON.stringify({email,password})});
if(!login.ok)throw new Error(`Login failed (${login.status})`);
const cookie=login.headers.get("set-cookie")?.split(";")[0];
const snapshotResponse=await fetch(`${api}/api/snapshot?workspace_id=edgars-latvia`,{headers:{Origin:api,Cookie:cookie}});
if(!snapshotResponse.ok)throw new Error(`Snapshot read failed (${snapshotResponse.status})`);
const snapshot=await snapshotResponse.json();
if(snapshot.opportunities?.length!==3)throw new Error("Unexpected migrated opportunity count");
const unauthorized=await fetch(`${api}/api/snapshot?workspace_id=edgars-latvia`,{headers:{Origin:api}});
if(unauthorized.status!==401)throw new Error("Unauthenticated snapshot access was not blocked");
console.log("Verified: app assets, health, authentication, authorized snapshot read, migrated data, and unauthorized-access rejection.");
