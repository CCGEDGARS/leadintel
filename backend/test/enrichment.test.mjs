import test from "node:test";
import assert from "node:assert/strict";
import {apolloSearchBody,enrichmentDecision,normalizeDomain,provenBusinessEmail,rankApolloPeople,strongPersonalEmail} from "../src/enrichment.js";

test("accepts only verified email on the company domain",()=>{
  assert.equal(provenBusinessEmail({email:"Leader@Example.com",email_status:"verified"},"https://www.example.com"),"leader@example.com");
  assert.equal(provenBusinessEmail({email:"leader@gmail.com",email_status:"verified"},"example.com"),"");
  assert.equal(provenBusinessEmail({email:"leader@example.com",email_status:"unverified"},"example.com"),"");
  assert.equal(provenBusinessEmail({email:"leader@other.com",email_status:"verified"},"example.com"),"");
});

test("enrichment requires score, evidence, domain, and available credits",()=>{
  const policy={minimum_score:7,daily_credit_limit:3,monthly_credit_limit:30};
  assert.equal(enrichmentDecision({score:8,evidenceCount:1,domain:"example.com",policy}).allowed,true);
  assert.equal(enrichmentDecision({score:6,evidenceCount:1,domain:"example.com",policy}).reason,"score_below_threshold");
  assert.equal(enrichmentDecision({score:8,evidenceCount:0,domain:"example.com",policy}).reason,"evidence_required");
  assert.equal(enrichmentDecision({score:8,evidenceCount:1,domain:"",policy}).reason,"company_domain_required");
  assert.equal(enrichmentDecision({score:8,evidenceCount:1,domain:"example.com",dailyReserved:3,policy}).reason,"daily_credit_limit");
});

test("accepts a personal email only for an exact person, company, and role match",()=>{
  const person={id:"person-1",title:"VP Sales",organization:{primary_domain:"example.com"},personal_emails:[{email:"leader@gmail.com",email_status:"verified"}]};
  assert.equal(strongPersonalEmail(person,"example.com","VP Sales","person-1"),"leader@gmail.com");
  assert.equal(strongPersonalEmail(person,"other.com","VP Sales","person-1"),"");
  assert.equal(strongPersonalEmail(person,"example.com","Finance Director","person-1"),"");
  assert.equal(strongPersonalEmail(person,"example.com","VP Sales","wrong-person"),"");
});

test("Apollo search requests one verified role match",()=>{
  assert.deepEqual(apolloSearchBody({domain:"https://www.example.com/about",role:"Sales Director"}),{q_organization_domains_list:["example.com"],person_titles:["Sales Director"],page:1,per_page:1});
  assert.equal(normalizeDomain("www.example.com"),"example.com");
});

test("Apollo contact ranking prefers the requested role and keeps identity evidence",()=>{
  const ranked=rankApolloPeople([
    {id:"p1",title:"Marketing Manager"},
    {id:"p2",title:"Commercial Director",linkedin_url:"https://www.linkedin.com/in/example"}
  ],"Commercial Director");
  assert.equal(ranked[0].id,"p2");
});
