import test from "node:test";
import assert from "node:assert/strict";
import {assessCandidate,compileQueries} from "../src/quality.js";

test("compiles language families into separate market-scoped searches",()=>{
  const result=compileQueries({query_id:"Q-1",latvian:"pārdošanas direktors OR vadītājs",english:"sales director OR head of sales",market:"Latvia",country:"LV"});
  assert.equal(result.length,2);
  assert.match(result[0].query,/Latvia LV$/);
  assert.doesNotMatch(result[0].query,/\) OR \(/);
});

test("rejects the dictionary OR result before model scoring",()=>{
  const result=assessCandidate({company_name:"Unknown",source_title:"OR Definition & Meaning",source_url:"https://www.merriam-webster.com/dictionary/or",signal_summary:"The meaning of OR is a function word",captured_at:new Date().toISOString()});
  assert.equal(result.passed,false);
  assert.ok(result.reasons.includes("junk_or_reference_page"));
  assert.ok(result.reasons.includes("commercial_signal_missing"));
});

test("accepts a fresh company-specific Latvian commercial signal",()=>{
  const result=assessCandidate({company_name:"Orkla Latvija",source_title:"Orkla Latvija hiring HoReCa Sales Manager",source_url:"https://lv.linkedin.com/jobs/sales-agent-jobs",signal_type:"Hiring",factual_evidence:"Orkla Latvija has a Sales Manager vacancy in Riga, Latvia.",captured_at:new Date().toISOString()});
  assert.equal(result.passed,true);
  assert.equal(result.checks.company_matches.includes("orkla"),true);
});
