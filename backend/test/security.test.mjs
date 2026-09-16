import test from "node:test";
import assert from "node:assert/strict";
import {allowedOrigin,constantTimeEqual,cookieValue,corsHeaders,isTrustedPreviewOrigin} from "../src/security.js";

test("allows only the configured application origin",()=>{
  const allowed=new Request("https://api.example.test",{headers:{Origin:"https://app.example.test"}});
  const secondAllowed=new Request("https://api.example.test",{headers:{Origin:"https://admin.example.test"}});
  const denied=new Request("https://api.example.test",{headers:{Origin:"https://evil.example.test"}});
  const configured="https://app.example.test, https://admin.example.test";
  assert.equal(allowedOrigin(allowed,configured),"https://app.example.test");
  assert.equal(allowedOrigin(secondAllowed,configured),"https://admin.example.test");
  assert.equal(allowedOrigin(denied,configured),"");
  const headers=corsHeaders("https://app.example.test");
  assert.equal(headers["Access-Control-Allow-Credentials"],"true");
  assert.match(headers["Access-Control-Allow-Headers"],/Idempotency-Key/);
  assert.match(headers["Access-Control-Allow-Methods"],/PATCH/);
  assert.match(headers["Access-Control-Allow-Methods"],/PUT/);
});


test("allows only trusted HTTPS LeadIntel preview origins",()=>{
  for(const origin of [
    "https://leadintel-g13t3b2us-ccgedgars-projects.vercel.app",
    "https://leadintel-git-feature-app-error-sweep-ccgedgars-projects.vercel.app"
  ]){
    assert.equal(isTrustedPreviewOrigin(origin),true,origin);
    const request=new Request("https://api.example.test",{headers:{Origin:origin}});
    assert.equal(allowedOrigin(request,"https://leadintel.ccgroup.lv"),origin);
  }
});

test("rejects lookalike, insecure, port-bearing and suffix-attack preview origins",()=>{
  for(const origin of [
    "https://leadintel-g13t3b2us-other-team.vercel.app",
    "https://other-project-ccgedgars-projects.vercel.app",
    "http://leadintel-g13t3b2us-ccgedgars-projects.vercel.app",
    "https://leadintel-g13t3b2us-ccgedgars-projects.vercel.app:8443",
    "https://leadintel-g13t3b2us-ccgedgars-projects.vercel.app.evil.test"
  ])assert.equal(isTrustedPreviewOrigin(origin),false,origin);
});

test("constant-time comparison returns the correct result",()=>{
  assert.equal(constantTimeEqual("secret","secret"),true);
  assert.equal(constantTimeEqual("secret","different"),false);
  assert.equal(constantTimeEqual("","secret"),false);
});

test("reads a named cookie",()=>{
  const request=new Request("https://api.example.test",{headers:{Cookie:"other=1; leadintel_session=abc123; final=2"}});
  assert.equal(cookieValue(request,"leadintel_session"),"abc123");
});
