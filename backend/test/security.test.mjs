import test from "node:test";
import assert from "node:assert/strict";
import {allowedOrigin,constantTimeEqual,cookieValue,corsHeaders} from "../src/security.js";

test("allows only the configured application origin",()=>{
  const allowed=new Request("https://api.example.test",{headers:{Origin:"https://app.example.test"}});
  const denied=new Request("https://api.example.test",{headers:{Origin:"https://evil.example.test"}});
  assert.equal(allowedOrigin(allowed,"https://app.example.test"),"https://app.example.test");
  assert.equal(allowedOrigin(denied,"https://app.example.test"),"");
  assert.equal(corsHeaders("https://app.example.test")["Access-Control-Allow-Credentials"],"true");
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
