# Scrapling Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real Scrapling runtime and route it as a verified third extraction step after Firecrawl and direct public-page extraction fail.

**Architecture:** A small Python Vercel-compatible HTTP function uses Scrapling 0.4.15 `Fetcher`. The Cloudflare backend gains a focused Scrapling client and only invokes it after retryable Firecrawl failure and failed direct extraction, preserving explicit provenance. The runtime is optional and never claimed when not configured.

**Tech Stack:** Cloudflare Workers JavaScript, Vercel Python Functions, Scrapling 0.4.15, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-07-scrapling-fallback-design.md`

## Global Constraints
- Firecrawl remains primary.
- Scrapling executes only after Firecrawl and direct extraction fail.
- Public-URL/SSRF protections remain mandatory.
- `source: scrapling-fallback` is emitted only after a successful Scrapling response.
- Missing Scrapling runtime is an unavailable fallback, not a successful tool execution.

---

### Task 1: Scrapling runtime contract
**Files:**
- Create: `api/scrapling.py`
- Create: `requirements.txt`
- Test: `backend/test/scrapling-contract.test.mjs`

- [ ] Write a failing contract test asserting the runtime file pins `scrapling==0.4.15`, rejects private hosts, requires POST JSON with a public URL, uses `Fetcher.get`, and emits `source: scrapling-fallback`.
- [ ] Run the test and confirm failure because the runtime does not exist.
- [ ] Implement the Python runtime with independent URL safety validation, optional bearer-token validation from `SCRAPLING_SERVICE_TOKEN`, size limits, normalized text/title/status metadata and deterministic JSON errors.
- [ ] Run the test and confirm pass.

### Task 2: Backend Scrapling client and fallback routing
**Files:**
- Create: `backend/src/scrapling.js`
- Modify: `backend/src/service-integrations.js`
- Test: `backend/test/scrapling-fallback.test.mjs`

**Interfaces:**
- `scraplingConfigured(env): boolean`
- `fetchWithScrapling(env,url): Promise<{success:boolean,data:{markdown:string,metadata:object}}>`

- [ ] Write failing tests for unavailable runtime, bearer token forwarding, malformed runtime response rejection, and successful provenance normalization.
- [ ] Implement `scrapling.js` with strict service URL validation, timeout, bearer token, payload validation, and normalized metadata.
- [ ] Extend Firecrawl scrape failure flow to attempt direct fallback first, then Scrapling, and audit only the path that actually succeeds.
- [ ] Run backend tests and syntax checks.

### Task 3: Deployment contract and documentation
**Files:**
- Modify: `backend/.dev.vars.example`
- Modify: `backend/README.md`
- Modify: `.github/workflows/backend-ci.yml`

- [ ] Add `SCRAPLING_SERVICE_URL` and optional `SCRAPLING_SERVICE_TOKEN` documentation.
- [ ] Add syntax/contract checks for the new backend module and runtime contract test.
- [ ] Run full backend CI.
- [ ] Open PR, review diff, merge only after CI success.
- [ ] Verify production exact SHA through release-integrity before calling Scrapling live.
