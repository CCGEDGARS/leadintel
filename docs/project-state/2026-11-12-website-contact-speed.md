# Website contact research: earlier results and bounded parallel work

Owner request: thirty minutes for an eleven-person website research run is unacceptable; improve the process using available resources. This change applies to independent Scan websites contact research, not seller-fit Buyers or protected outreach templates.

## Observed causes and controlled reproductions

- Discovery read up to forty company pages before starting the retained contacts. The free Apollo leadership pass also ran after that crawl.
- The website worker passed one person at a time into the shared mandatory-research engine, despite that engine supporting concurrency. This is separate from the previously repaired first-person starvation defect.
- Firecrawl searches requested scraped markdown, but this worker retained only search excerpts and subsequently acquired the selected page in its own provenance-checked read task.
- Opening retained active work only polled GET. After its initial HTTP processing slice, continuation depended on the minute scheduler, including while the user watched the page.
- A thirty-minute pass boundary was labelled Paused, implying the user had stopped it.

New tests failed on the old implementation for serialized processing, delayed first contacts, discarded search extraction and absent native active-job wake.

## Implementation and ownership

Keep the existing durable SQL job, lease, registered minute scheduler, source attribution functions and complete mandatory research plans. Improve their scheduling rather than introducing another job owner or provider integration.

1. Read and verify the company homepage, run the existing free Apollo leadership identity pass, and read up to three likely official contact/team pages early. Alternate three-person contact work with broader discovery. Deliver the first ten-contact batch without waiting for the remaining company crawl. Retain its discovery cursor and planned source URLs for explicit continuation; the forty-page/three-hundred-person bounds remain.
2. Process at most three people or discovery pages concurrently. Coalesce simultaneous requests for the same source/query and serialize SQL checkpoints under the existing lease and exact company/session/role authority. Partial receipts, identity holds and late-result rejection remain authoritative.
3. Website URL discovery omits Firecrawl scrapeOptions; selected underlying pages still require the existing explicit source read and attribution checks. Give the primary search provider six seconds before its existing configured grounded fallback. Other consumers retain their current transport defaults. No new provider or credential source is invented.
4. An authenticated POST wake accelerates only an existing active job. It cannot extend its deadline, reset failed attempts, change authority or restart incomplete/stopped work. The visible client requests it while polling active research; concurrent wakes respect the durable lease. GET remains read-only. The registered scheduler continues when the browser is closed.
5. New and explicitly resumed passes have a five-minute time budget. Reaching it saves partial evidence with time_limit and an explicit continuation action. This is an execution bound, not a promise that all provider-dependent checks finish within five minutes. Old saved job records need no schema migration; their receipts remain usable. The old thirty-minute caption is recognised as a time-limit outcome in the read model.

## Resource and evidence boundaries

Public Firecrawl research, configured grounded fallback and Gemini independent checks, and Apollo identity-only discovery retain their existing workspace credentials and actual execution receipts. Search snippets do not establish direct contacts. The three Gmail business-contact queries, deeper unresolved-person queries, explicit page reads, attribution/identity checks and paid eligibility rules are unchanged. Completing coverage does not confirm ownership or deliverability. No automatic paid reveal or outreach is introduced.

The private Sun Finance job and its provider account receipts were not accessed. Controlled provider latency is not a production latency measurement. Available credentials in the customer application are not credentials in this coding environment.

## Acceptance

- Registered scheduler with real SQL: peak three simultaneous people, one underlying shared read, partial-source retries and next-person fairness.
- Known management checks start after at most four page reads in a thirty-nine-link fixture, with the wider source limit retained.
- Real mandatory query plans execute concurrently: every retained identity has all three Gmail queries and required deep checks; source receipts are reused and zero paid attempts are dispatched.
- Actual native HTTP wake starts work; a concurrent wake cannot duplicate the held homepage request. Wake preserves deadline and receipts, and a canceled job stays canceled.
- Exact company replacement during three concurrent reads rejects all late writes.
- Five-minute budget expiration is saved as time_limit, not a user pause. Frontend opens active work with wake but never auto-resumes incomplete work.
- Existing native authenticated desktop/mobile Stop, Resume, scheduler-after-browser-close and fresh-reopen journeys remain required.

Controlled comparison: eleven retained official identities, full mandatory plans, twenty-millisecond public search responses and real registered scheduler/SQL. Previous revision: 2,998 ms, peak concurrency one, 122 search calls. New worker before the final first-batch scheduling adjustment: 1,238 ms, peak concurrency three, 123 search calls. Both completed all eleven people, all three Gmail queries and deep plans, reused the saved page and made zero paid contact calls. Both needed two scheduler wakes under the shared invocation budget. Approximately 2.4 times faster active processing in this fixture is not a live-source SLA or evidence of fewer network calls.

## Compatibility and rollback

No database migration, source deletion, CRM contact mutation or master-template change. Existing jobs gain only optional state fields. Resume preserves current behavior for failed-source retries and increments its existing revision. Rollback restores the previous worker/client and transport defaults; optional fields are ignored, saved source receipts and contact identities remain. Cache versions must change together. Exact-SHA CI, live manifest, backend deployment/health and release proof remain separate from controlled acceptance and private-customer acceptance.
