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

test("constant-time comparison returns the correct result",()=>{
  assert.equal(constantTimeEqual("secret","secret"),true);
  assert.equal(constantTimeEqual("secret","different"),false);
  assert.equal(constantTimeEqual("","secret"),false);
});

test("reads a named cookie",()=>{
  const request=new Request("https://api.example.test",{headers:{Cookie:"other=1; leadintel_session=abc123; final=2"}});
  assert.equal(cookieValue(request,"leadintel_session"),"abc123");
});
