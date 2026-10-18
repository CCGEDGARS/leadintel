# Website Scanning Implementation Plan

> For agentic workers: implement natively in this session using the executing-plans workflow.

**Goal:** Turn supplied public pages into reviewed company lists connected to CRM and existing buyer/campaign tools.
**Architecture:** Pure extraction/validation engine, cancellable provider runner, UI controller with persisted workspace snapshots. Existing CRM and campaign APIs own durable companies and subsequent buyer research; existing monitoring DOM is reused.
**Tech Stack:** Vanilla JS, existing Firecrawl/AI services, existing CRM and campaign API, node:test/jsdom.
**Spec:** docs/superpowers/specs/2026-10-18-website-scanning.md

## Global constraints
Up to 50 companies per scan; 3 concurrent identity checks; requests bounded; no automatic research on load; no fabricated identities/contact data; no automatic sending; workspace isolation and suppression preserved.

## Review focus
Missing outbound links require search and review, not invented domains. Long rankings must expose source coverage. Source text is untrusted. Account/input changes cannot accept late output. Scan deletion does not delete imported CRM companies.

## Tasks
- [ ] Engine: customer/website-scanning.js. Tests: customer/test/website-scanning.test.js. safeUrl, parseExtraction, assessIdentity, normalizeSnapshot, createRunner. Ground candidate names and quotes in source evidence; filter unsafe/site-navigation candidates; resolve/check websites; bounded cancel and race checks.
- [ ] Handoff: add LeadIntelEmailCampaignUI.openCompanyList(rows, options) using existing import/company-list/create APIs and openResearch. Add CRM provenance through existing recordCrmActivity. Test stale account, partial import, suppression errors and campaign audience isolation.
- [ ] UI: customer/website-scanning-ui.js + CSS. Mount under reference card; move monitoring DOM inside monitoring mode; scan/edit/select/check/save/campaign/history actions. Persist via main.websiteScans and preserve normalization. Test placement, busy/cancel, reload, manual verification invalidation, empty/error and deletions.
- [ ] Full node --test customer/test/*.test.js, build and syntax checks. Publish exact Git tree, wait exact-SHA CI, run existing production proof and authenticated live acceptance.
