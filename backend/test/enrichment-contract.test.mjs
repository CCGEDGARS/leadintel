import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as Enrichment from "../src/enrichment.js";

test("Apollo people search uses the current zero-credit API Search endpoint",()=>{
  assert.equal(
    Enrichment.APOLLO_PEOPLE_SEARCH_URL,
    "https://api.apollo.io/api/v1/mixed_people/api_search"
  );
});

test("legacy enrichment compatibility route cannot call Apollo's retired people search endpoint",()=>{
  const source=fs.readFileSync(new URL("../src/index.js",import.meta.url),"utf8");
  assert.doesNotMatch(source,/api\/v1\/mixed_people\/search/);
  assert.match(source,/APOLLO_PEOPLE_SEARCH_URL/);
});

test("Apollo phone callback cannot fall back to a different person",()=>{
  const source=fs.readFileSync(new URL("../src/apollo-crm-webhook.js",import.meta.url),"utf8");
  assert.doesNotMatch(source,/\|\|people\[0\]/);
  assert.match(source,/people\.find\([\s\S]*personId/);
});

test("Apollo people search is domain scoped and accepts up to four requested roles",()=>{
  const body=Enrichment.apolloSearchBody({
    domain:"https://www.acme.com/about?source=leadintel",
    roles:["Procurement Director","COO","Head of Operations","Managing Director","Unrelated Fifth Role"]
  });
  assert.deepEqual(body.q_organization_domains_list,["acme.com"]);
  assert.deepEqual(body.person_titles,["Procurement Director","COO","Head of Operations","Managing Director"]);
  assert.deepEqual(body.person_seniorities,["owner","founder","c_suite","partner","vp","head","director","manager"]);
  assert.equal(body.include_similar_titles,true);
  assert.equal(body.page,1);
  assert.equal(body.per_page,10);
  assert.equal("api_key" in body,false);
});

test("Apollo paid-match builder is safe by default and requires a webhook for phone or waterfall requests",()=>{
  assert.equal(typeof Enrichment.buildApolloMatchUrl,"function");
  if(typeof Enrichment.buildApolloMatchUrl!=="function")return;

  const safe=new URL(Enrichment.buildApolloMatchUrl({personId:"person-1"}));
  assert.equal(safe.origin+safe.pathname,"https://api.apollo.io/api/v1/people/match");
  assert.equal(safe.searchParams.get("id"),"person-1");
  assert.equal(safe.searchParams.get("reveal_personal_emails"),"false");
  assert.equal(safe.searchParams.get("reveal_phone_number"),"false");
  assert.equal(safe.searchParams.get("run_waterfall_email"),"false");
  assert.equal(safe.searchParams.get("run_waterfall_phone"),"false");
  assert.equal(safe.searchParams.has("webhook_url"),false);

  assert.throws(
    ()=>Enrichment.buildApolloMatchUrl({personId:"person-1",phoneLookup:true}),
    /webhook/i
  );
  const withPhone=new URL(Enrichment.buildApolloMatchUrl({
    personId:"person-1",
    phoneLookup:true,
    webhookUrl:"https://leadintel.example/api/apollo/webhook"
  }));
  assert.equal(withPhone.searchParams.get("reveal_phone_number"),"true");
  assert.equal(withPhone.searchParams.get("webhook_url"),"https://leadintel.example/api/apollo/webhook");
});
