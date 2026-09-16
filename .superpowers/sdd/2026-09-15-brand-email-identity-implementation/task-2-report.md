# Task 2 Report: R2 Asset Boundary

Date: 2026-09-15  
Repository: `CCGEDGARS/leadintel`  
Branch: `codex/brand-email-identity`  
Required starting head: `4e1bab454a32124115c20a691cd930cf8cbac900`  
Final branch head: `3007698be0c9c86d9d6d24a36d5b8a08201167ad`  
Status: Complete; implementation and tests are committed to the isolated branch. No changes were made to `main`.

## Summary

Implemented the Cloudflare R2 boundary for customer brand assets. The Worker now supports authenticated upload, authenticated server-side import, public opaque reads, and authenticated deletion at the required endpoints:

- `POST /api/customer/brand-assets?workspace_id=...`
- `POST /api/customer/brand-assets/import?workspace_id=...`
- `GET /api/customer/brand-assets/:asset_id`
- `DELETE /api/customer/brand-assets/:asset_id?workspace_id=...`

The implementation exports the required `handleBrandAssetRoute(request, env, cors)` and `validateBrandAsset(file, kind)` functions. It also exports focused object-key, deletion, and replacement primitives for later customer-state/reset integration without coupling this route to the frontend state shape.

## Commits

The work is five commits ahead of the required base:

1. `52a79dd83fed3a9fbc9bf660fc94e6439bbb1a1f` — `test: define R2 brand asset boundary`
2. `f8e6719f2d11efd96ef1417ea1ce84279fb83f63` — `test: reject appended brand asset payloads`
3. `b020321897ba59aff0e537a7f61feea9822847e7` — `test: cover import stream timeout`
4. `d8f2c0e1e17a883f4e393637ca26699c80e8a876` — `feat: add R2 brand asset boundary`
5. `3007698be0c9c86d9d6d24a36d5b8a08201167ad` — `fix: preserve backend package scripts`

The first three commits contain failing tests only. Production implementation was not committed until the RED behavior had been observed and recorded.

## Files Changed

Remote comparison from the required base to the final head shows only these files changed:

| File | Change | Purpose |
| --- | --- | --- |
| `backend/src/brand-assets.js` | Added | Validation, authorization, R2 persistence, import controls, public serving, deletion, audit, and replacement primitives |
| `backend/test/brand-assets.test.js` | Added | Asset-boundary behavior and security tests |
| `backend/src/app.js` | Modified | Delegates brand-asset requests to the new route before request-scoped service credential decoration |
| `backend/wrangler.toml` | Modified | Declares the R2 binding named exactly `BRAND_ASSETS` |
| `backend/package.json` | Modified | Broadens the test glob from `test/*.test.mjs` to `test/*.test.*`, ensuring the required `.test.js` file runs in the repository test command |

The final GitHub comparison reported five files changed, with no unrelated source changes.

## Implementation Details

### Asset validation

`validateBrandAsset(file, kind)`:

- Allows only `image/png`, `image/jpeg`, and `image/webp`.
- Requires the declared MIME type to match parsed magic bytes.
- Parses dimensions from PNG IHDR, JPEG SOF markers, and WebP VP8X/VP8/VP8L headers.
- Rejects empty and malformed files.
- Rejects SVG, data payloads, executable signatures, MIME mismatches, and appended payloads that violate the recognized image container structure.
- Enforces a 2 MiB limit for `logo`.
- Enforces a 5 MiB limit for `headshot` and `banner`.
- Rejects dimensions outside 1–6000 pixels on either axis.

### Opaque IDs and R2 isolation

- Asset IDs contain a one-way, truncated SHA-256 workspace scope plus a 24-byte cryptographically random token.
- IDs match `^[a-f0-9]{16}_[A-Za-z0-9_-]{32}$` and do not expose workspace names, user emails, or original filenames.
- R2 keys are workspace-scoped as `workspaces/{scope}/brand-assets/{asset_id}`.
- Public URLs use the exact Task 1 origin and path contract: `https://leadintel-api.edgars-7e7.workers.dev/api/customer/brand-assets/:id`.
- Original filenames are not returned or embedded in public identifiers.

### Authorization and audit

- Upload, import, and delete authenticate the existing `leadintel_session` cookie using the established SHA-256 session lookup pattern.
- Each mutation verifies membership in the requested workspace.
- Mutation access is limited to `owner` and `researcher`; `sales`, anonymous users, and cross-workspace requests are denied.
- Upload, import, and deletion write audit events using the existing `audit_events` schema.
- R2 upload bytes are removed if writing the corresponding audit event fails, avoiding an unaudited orphan from that operation.

### Public reads

- Public GET requires no workspace identifier and derives the isolated R2 key from the opaque asset ID.
- The retrieved bytes are rechecked as an approved image before being served.
- A stored content type, when present, must agree with the detected image type.
- Invalid or corrupted stored objects return 404 rather than unsafe bytes.
- Successful responses use the detected exact content type and include:
  - `X-Content-Type-Options: nosniff`
  - `Cache-Control: public, max-age=31536000, immutable`
  - Exact `Content-Length`
- Public responses expose no workspace metadata.

### Server-side import controls

- Imports accept only HTTP or HTTPS URLs.
- Credentials in URLs are rejected.
- Local, private, loopback, link-local, and reserved literal targets are rejected before outbound fetch.
- Local/internal hostname suffixes and single-label hosts are rejected.
- Every redirect target is revalidated.
- Redirect handling is manual and limited to three redirects.
- Fetches use an `AbortController` timeout of 5 seconds, covering both response acquisition and bounded body reading.
- Declared and streamed response lengths are bounded according to the requested asset kind.
- Response MIME, magic bytes, dimensions, and image container structure are validated before R2 persistence.
- Import errors are normalized to bounded 4xx/5xx responses rather than exposing upstream error details.

### Replacement safety and later state integration

`replaceBrandAsset(env, {workspaceId, previousAssetId, nextAsset, saveMetadata})` provides the later customer-state integration point:

1. Verify the new asset belongs to the workspace.
2. Invoke the supplied metadata persistence callback.
3. Delete the old R2 object only after metadata persistence succeeds.
4. If metadata persistence fails, preserve the old object and remove the newly uploaded object to avoid an orphan.

`deleteBrandAsset` and `brandAssetObjectKey` are separately exported for later reset/state cleanup. The current route returns asset metadata for customer-state persistence but does not introduce a second metadata table or encode frontend state structure into the R2 route.

### Worker configuration

`backend/wrangler.toml` now includes:

```toml
[[r2_buckets]]
binding = "BRAND_ASSETS"
bucket_name = "leadintel-brand-assets"
```

No Cloudflare resources were provisioned, modified, or deleted during this task.

## TDD Evidence

The `superpowers:test-driven-development` workflow was followed: write the behavioral test, run it and inspect the expected failure, then implement the minimum production behavior and rerun focused and complete suites.

### Initial RED

Command:

```bash
cd /workspace/scratch/2b1c891fdb41/leadintel/backend
node --test test/brand-assets.test.js
```

Relevant output:

```text
✖ brand asset module exists and exposes the boundary functions
...
ℹ tests 14
ℹ pass 0
ℹ fail 14
...
AssertionError [ERR_ASSERTION]: ifError got unwanted exception:
Cannot find module '.../backend/src/brand-assets.js'
```

Exit code: `1`. This was the expected failure because the production boundary did not exist. It was committed as `52a79dd83fed3a9fbc9bf660fc94e6439bbb1a1f` before implementation.

### Polyglot RED

Command:

```bash
node --test --test-name-pattern='executable payload appended' test/brand-assets.test.js
```

Relevant output:

```text
✖ an executable payload appended to an otherwise recognized image is rejected
ℹ tests 1
ℹ pass 0
ℹ fail 1
AssertionError [ERR_ASSERTION]: Missing expected rejection.
```

Exit code: `1`. This proved that signature-only recognition did not catch appended payloads. The failing regression test was committed as `f8e6719f2d11efd96ef1417ea1ce84279fb83f63` before structural parsing was tightened.

### Stream-timeout RED

Command:

```bash
node --test --test-name-pattern='timeout while reading' test/brand-assets.test.js
```

Relevant output:

```text
✖ an import timeout while reading image bytes returns a bounded gateway error
ℹ tests 1
ℹ pass 0
ℹ fail 1
AbortError: Timed out
```

Exit code: `1`. This proved that a body-stream abort escaped instead of becoming the required bounded gateway response. The failing test was committed as `b020321897ba59aff0e537a7f61feea9822847e7` before the timeout was extended across bounded response reading.

### Focused GREEN

Command:

```bash
node --check src/brand-assets.js && node --test test/brand-assets.test.js
```

Relevant output:

```text
✔ brand asset module exists and exposes the boundary functions
✔ PNG, JPEG, and WebP require matching MIME and return decoded dimensions
✔ an executable payload appended to an otherwise recognized image is rejected
✔ an import timeout while reading image bytes returns a bounded gateway error
...
ℹ tests 16
ℹ pass 16
ℹ fail 0
```

Exit code: `0`.

### Full backend GREEN

Repository command:

```bash
cd /workspace/scratch/2b1c891fdb41/leadintel/backend
npm test
```

Final relevant output:

```text
> test
> node --test test/*.test.*
...
ℹ tests 257
ℹ suites 0
ℹ pass 257
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

Exit code: `0`.

Because the supplied directory was a partial non-git export, the unchanged backend source, tests, migrations, workflow fixtures, `api/scrapling.py`, `requirements.txt`, and `render.yaml` were mirrored locally from the target branch solely to run the complete repository suite. These local verification files were not written to GitHub and are not part of the branch diff.

Intermediate full-suite runs failed only because those unchanged files had not yet all been mirrored locally (for example, missing existing security exports and repository-level Scrapling/workflow fixtures). After restoring the unchanged branch files, the same repository command passed 257/257.

## Test Coverage

The new tests cover:

- Required exports and unrelated-route fallthrough.
- PNG, JPEG, and WebP MIME/magic-byte agreement and dimensions.
- SVG, data payload, executable, mismatched MIME, malformed structure, and appended payload rejection.
- 2 MiB logo and 5 MiB headshot/banner limits.
- 6000 × 6000 maximum dimensions.
- Anonymous, wrong-role, non-member, owner, and researcher authorization behavior.
- Opaque URLs and absence of workspace, email, and original filename data.
- Workspace-scoped R2 object keys.
- Public safe headers, exact bytes, and fail-closed handling of corrupted R2 content.
- Authenticated deletion, workspace isolation, R2 removal, and deletion audit.
- Public HTTP image import, manual redirect behavior, timeout signal, response validation, and import audit.
- Data/local/private/link-local URL rejection and redirect target revalidation.
- Excessive redirects, oversized responses, unsupported response types, and magic mismatch rejection.
- Stream abort normalization to HTTP 504.
- Metadata-before-old-byte deletion ordering and failed-replacement preservation.

## Self-Review

- Verified the target branch was exactly at the required starting SHA before the first write.
- Used connected GitHub operations for all branch reads and writes.
- Created commits only on `codex/brand-email-identity`; `main` was not modified.
- Confirmed the final branch head and fetched each changed file from the branch after committing.
- Compared the required base SHA with the final SHA. The comparison reported exactly five changed files and the expected five commits.
- Confirmed the public URL origin and route exactly match the Task 1 contract.
- Confirmed the binding is named exactly `BRAND_ASSETS`.
- Confirmed no original filename, workspace name, or user email is returned in asset metadata or embedded in the public URL.
- Confirmed the R2 object path is workspace-scoped without making workspace identity public.
- Confirmed mutation roles match the existing SaaS convention while excluding `sales` from brand-identity writes.
- Confirmed public GET fails closed on invalid bytes and sets strict response headers.
- Confirmed redirects are manual, bounded, and revalidated, and streamed bodies are size- and timeout-bounded.
- Confirmed replacement deletes old bytes only after metadata save succeeds and preserves old bytes on a failed save.
- Confirmed all existing backend scripts and the Wrangler dev dependency were preserved. Remote verification caught an initial focused-manifest overwrite in the implementation commit; commit `3007698be0c9c86d9d6d24a36d5b8a08201167ad` restored the original manifest with only the intended test-glob change.
- Re-ran the full backend suite after that correction: 257/257 passed.

## Concerns and Follow-Up

### R2 provisioning

The Worker configuration names the bucket `leadintel-brand-assets`, but this task intentionally did not provision or inspect external Cloudflare resources. The bucket must exist in the deployment account before deploying this configuration. If the production bucket uses a different name, update only `bucket_name`; the Worker binding must remain exactly `BRAND_ASSETS`.

### DNS-resolved private destinations

Import validation blocks local/private/link-local literal addresses, local/internal hostnames, credentials, unsafe schemes, and unsafe redirects in application code. It does not perform an independent DNS resolution and post-resolution IP check. Protection against a public hostname resolving or rebinding to private infrastructure therefore also relies on Cloudflare Workers' outbound networking boundary. If the deployment later gains private-network connectivity, add a controlled egress proxy or resolver-enforced allow policy before enabling imports through that connectivity.

### Later customer-state integration

This task deliberately leaves frontend state shape and reset orchestration to later work. That work should use `replaceBrandAsset` for replacement and `deleteBrandAsset` for reset cleanup so state revision success remains the gate before old-byte deletion. Direct DELETE is intentionally idempotent at the byte boundary; callers that remove an active reference should save the corresponding customer-state revision before invoking it.

---

## Review Fix Report — 2026-09-15

### Status and commits

All Critical, Important, and requested minor review findings were fixed on `codex/brand-email-identity`. The branch head was verified after the writes as `0000aab8832ece8157db8815091f31452c4ff8c8`; `main` was not modified.

1. `6091c074b29300c2f7ae98be369afb89565c0e77` — `test: cover R2 boundary review findings` (RED)
2. `9092700bb30a09ca47dcf4183aecfa998e5e7236` — `fix: harden R2 brand asset boundary` (GREEN)
3. `0000aab8832ece8157db8815091f31452c4ff8c8` — `style: expand public asset security flow` (maintainability follow-up, GREEN retained)

### Implementation details

1. Import SSRF policy
   - Added an explicit, deployment-configured `BRAND_ASSET_IMPORT_HOSTS` allowlist.
   - Imports are disabled when that allowlist is empty; direct multipart uploads remain available.
   - Entries are exact hosts or exact HTTP(S) origins. Host entries permit only standard HTTP/HTTPS ports; origin entries must match the full origin.
   - The policy rejects credentials, unsafe schemes, local/internal names, private literals, and DNS-alias/private-lookalike names unless the exact hostname was deliberately configured.
   - Every redirect is handled manually and checked against the same allowlist before the next `fetch`, so an unapproved redirect target is rejected before any request is sent to it.

2. Structural image validation
   - PNG parsing now validates the signature, chunk bounds, CRCs, a single valid IHDR, valid bit-depth/color-type combinations, at least one non-empty IDAT, an exact terminal IEND, and no trailing bytes or unknown critical chunks.
   - JPEG parsing now walks markers, requires a valid SOF and SOS, requires entropy data followed by terminal EOI, accepts `FF00` entropy byte stuffing and restart markers, and rejects malformed/trailing payloads.
   - WebP parsing now validates RIFF size equality, chunk bounds/padding, and requires exactly one supported VP8 or VP8L image chunk with valid dimensions and no trailing bytes.
   - Header-only test data was replaced by genuine PNG, JPEG, and VP8 WebP fixtures. The JPEG fixture contains a real `FF00` stuffed entropy sequence.

3. Audited deletion contract
   - `deleteBrandAsset` is now the single irreversible deletion primitive.
   - It checks ownership from private R2 metadata, successfully writes the required audit record, and only then deletes the object.
   - The DELETE route and replacement/rollback helpers pass user and event context through this same primitive.
   - Audit failures propagate without deleting bytes. Replacement still saves metadata before auditing and deleting the old object.

4. Opaque ownership
   - Public asset IDs and R2 object suffixes are fully random 32-byte base64url tokens (43 characters); no workspace digest or stable workspace-derived prefix remains.
   - Workspace ownership is stored only in R2 `customMetadata.workspaceId` and is checked with `head` before mutation.

5. Public read routing
   - The production app dispatches public brand-asset GETs before application Origin rejection.
   - Mutation routes remain behind the existing Origin, authentication, workspace-membership, and role checks. A disallowed Origin receives asset bytes without an allow-origin header, rather than an application-level 403.

6. Minor findings
   - Security-sensitive one-line control flow in `brand-assets.js` was expanded for auditability.
   - The package test script is narrowed to `test/*.test.js test/*.test.mjs`; the complete backend suite remains included.

### RED evidence

Tests were changed and committed before production implementation changes.

Exact command, from `backend/`:

```bash
node --test test/brand-assets.test.js
```

Exact aggregate output from the reviewed implementation, preceded by failures in the listed regression areas:

```text
ℹ tests 22
ℹ suites 0
ℹ pass 9
ℹ fail 13
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

Exit code: `1`. The 13 failing assertions demonstrated the old lexical-only import policy, insufficient structure parsing (including stuffed JPEG rejection), workspace-correlated IDs, delete-before-audit behavior, unaudited primitive/replacement paths, and public GET Origin blockage. This evidence is preserved in the RED commit `6091c074b29300c2f7ae98be369afb89565c0e77`.

### Focused GREEN evidence

Exact command, from `backend/`:

```bash
node --check src/brand-assets.js && node --check src/app.js && node --test test/brand-assets.test.js
```

Relevant output:

```text
✔ genuine PNG, stuffed-entropy JPEG, and VP8 WebP fixtures return decoded dimensions
✔ malformed PNG chunks, JPEG without a scan, and WebP without image data are rejected
✔ route deletion leaves bytes intact when the required audit write fails
✔ missing allowlist, arbitrary hosts, DNS aliases, and private-lookalike hosts are rejected before fetch
✔ redirects are rechecked against the host allowlist before the redirected fetch
✔ production app serves public asset GET before rejecting an unrelated Origin
...
ℹ tests 22
ℹ suites 0
ℹ pass 22
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

Exit code: `0`.

### Full backend GREEN evidence

Exact command, from `backend/`:

```bash
npm test
```

Relevant output:

```text
> test
> node --test test/*.test.js test/*.test.mjs
...
ℹ tests 263
ℹ suites 0
ℹ pass 263
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2058.178668
```

Exit code: `0`. The only diagnostic outside the test runner was npm's environment warning: `Unknown env config "http-proxy"`; it did not affect execution or results.

### Files changed in the review-fix cycle

- `backend/test/brand-assets.test.js` — genuine fixtures and regressions for strict parsing, allowlisted imports/redirects, audit ordering/failure, opaque IDs, shared primitive behavior, replacement cleanup, and app routing.
- `backend/src/brand-assets.js` — strict image parsers, configured import allowlist, random IDs/private ownership metadata, and unified audited deletion.
- `backend/src/app.js` — public GET dispatch before Origin denial.
- `backend/package.json` — explicit `.test.js` and `.test.mjs` test globs.
- `backend/wrangler.toml` — empty-by-default `BRAND_ASSET_IMPORT_HOSTS` deployment setting.

### Self-review

- Confirmed the implementation commit is a direct child of the RED commit, the maintainability commit is a direct child of the implementation commit, and the remote branch head is exactly `0000aab8832ece8157db8815091f31452c4ff8c8`.
- Confirmed all branch writes used connected GitHub operations and were scoped to `codex/brand-email-identity`.
- Confirmed no external Cloudflare resources were provisioned, inspected, or deleted.
- Confirmed the public URL contract remains exactly `https://leadintel-api.edgars-7e7.workers.dev/api/customer/brand-assets/:id`.
- Confirmed only `deleteBrandAsset` calls R2 `delete`, with audit completion before that call.
- Confirmed public IDs contain no workspace-derived component and ownership checks use private R2 custom metadata.
- Confirmed every initial and redirected import URL is approved before `fetch`.
- Confirmed direct upload behavior remains available when imports are disabled.
- Confirmed mutations still pass through normal Origin/auth/role handling while only public GET bypasses Origin denial.
- Re-ran both focused and full suites after the final maintainability change; 22/22 focused and 263/263 full passed.

### R2 provisioning and deployment concerns

This task only configures code and bindings. The `leadintel-brand-assets` R2 bucket must be provisioned separately in the correct Cloudflare account before deployment, and the Worker binding must remain `BRAND_ASSETS`. No external bucket was created or removed here.

`BRAND_ASSET_IMPORT_HOSTS` is intentionally committed as an empty value. Production imports will reject every host until the authenticated extraction flow supplies a reviewed set of exact source hosts/origins through deployment configuration; direct file upload is unaffected. This fail-closed default prevents arbitrary user-supplied URL imports and DNS-alias SSRF.

If the audit write for a newly uploaded object fails after the R2 put, the request fails but an unreferenced object can remain. The implementation deliberately does not perform an unaudited compensating deletion because the required contract forbids irreversible deletion before a successful audit record. Operational lifecycle cleanup for such unreferenced objects should use the same audited deletion policy.

---

## Review Fix Report — Round 2 — 2026-09-15

### Status and commits

Both round-2 blockers were fixed through RED/GREEN on `codex/brand-email-identity`. The branch head after the implementation write is `52632bf11d15bd27c635eaa46d2361fb7e5407cf`; `main` was not modified.

1. `f5d53aa4db6ee3ea50faf8ce18d18bcd3c7c7733` — `test: expose decoder and upload-audit gaps` (RED)
2. `b476cee0be7581c2a206afac86238367de4aea16` — `test: require truthful pre-upload audits` (RED follow-up)
3. `52632bf11d15bd27c635eaa46d2361fb7e5407cf` — `fix: require decoded images and pre-audited uploads` (GREEN)

### Implementation details

#### Decoder-level image acceptance

- Added exact runtime dependencies `@jsquash/png@3.1.1`, `@jsquash/jpeg@1.6.0`, and `@jsquash/webp@1.5.0`. These browser/Web Worker-focused WebAssembly packages use the Rust PNG decoder, MozJPEG, and libwebp respectively and document Cloudflare Worker usage.
- Added `src/image-decoders.js`, which statically imports the three decoder WASM modules in the form supported by Wrangler and initializes them once per isolate.
- Kept strict container framing as a separate precondition: PNG CRC/chunk/IEND checks, exact JPEG terminal EOI and marker framing, and exact WebP RIFF sizing still reject trailing bytes before decode. The custom code is not treated as proof that image payloads decode.
- `validateBrandAsset` now performs the strict container check, enforces the existing byte and 6000 × 6000 limits before decode, then requires a full decoder result with matching dimensions and a complete RGBA pixel buffer.
- Public GET applies the same full decode check before serving stored bytes, retaining fail-closed behavior for corrupted R2 content.
- Added a small Node test loader because Node does not expose Wrangler's default `.wasm` module handling. Production continues to use static Worker-compatible WASM imports; the loader is test-only.
- Genuine PNG, JPEG, and VP8 WebP fixtures remain positive tests. The genuine JPEG still proves acceptance of `FF00` entropy byte stuffing.
- Added negative probes which the old custom parsers accepted: a CRC-valid PNG with invalid compressed pixels, a marker-valid JPEG with an invalid entropy scan, and a RIFF-valid WebP containing an invalid VP8 frame.

#### Pre-audited R2 writes

- `createAsset` now allocates the opaque asset ID, resolves the R2 binding, constructs metadata, and durably writes the authorization/intention audit before calling `R2.put`.
- Direct uploads use `brand_asset.upload_authorized`; imports use `brand_asset.import_authorized`. Neither event falsely claims that object storage completed.
- No post-put completion audit is required, so an audit backend failure cannot turn successfully stored bytes into an unreachable request failure.
- If the required intention audit fails, the error propagates before any R2 write. The regression test proves no `put` event occurred and the in-memory bucket contains zero objects.
- Existing audited-before-delete behavior, random opaque IDs/private ownership metadata, import allowlisting and redirect checks, public GET routing, and explicit test globs remain covered and passing.

### RED evidence

Initial exact command from `backend/`:

```bash
node --test test/brand-assets.test.js
```

Relevant exact output:

```text
✖ CRC-valid PNG with undecodable pixel data is rejected
✖ marker-valid JPEG with an undecodable entropy scan is rejected
✖ RIFF-valid WebP with an undecodable VP8 frame is rejected
✖ failed upload intention audit prevents the R2 put and leaves no orphan
ℹ tests 26
ℹ suites 0
ℹ pass 22
ℹ fail 4
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

Exit code: `1`. Each decoder probe failed with `Missing expected rejection`; the orphan test observed a `put` despite the failed audit.

After adding the truthful-event/order assertions, the same exact command produced:

```text
✖ CRC-valid PNG with undecodable pixel data is rejected
✖ marker-valid JPEG with an undecodable entropy scan is rejected
✖ RIFF-valid WebP with an undecodable VP8 frame is rejected
✖ failed upload intention audit prevents the R2 put and leaves no orphan
✖ successful upload records an authorized attempt before the R2 put
✖ server-side import accepts only a configured host and audits the stored image
ℹ tests 27
ℹ suites 0
ℹ pass 21
ℹ fail 6
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 148.770501
```

Exit code: `1`. The ordering diff showed actual `[put, brand_asset.uploaded audit]` versus required `[brand_asset.upload_authorized audit, put]`; the import assertion showed `brand_asset.imported` versus required `brand_asset.import_authorized`.

### Focused GREEN evidence

Final exact command from `backend/`:

```bash
node --check src/brand-assets.js && node --check src/image-decoders.js && node --check src/app.js && node --import ./test/register-wasm-loader.mjs --test test/brand-assets.test.js
```

Relevant exact output:

```text
✔ genuine PNG, stuffed-entropy JPEG, and VP8 WebP fixtures return decoded dimensions
✔ CRC-valid PNG with undecodable pixel data is rejected
✔ marker-valid JPEG with an undecodable entropy scan is rejected
✔ RIFF-valid WebP with an undecodable VP8 frame is rejected
✔ failed upload intention audit prevents the R2 put and leaves no orphan
✔ successful upload records an authorized attempt before the R2 put
...
ℹ tests 27
ℹ suites 0
ℹ pass 27
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 298.170271
```

Exit code: `0`.

### Full backend GREEN evidence

Final warning-free command from `backend/` (the environment-only npm proxy aliases were unset for clean output):

```bash
env -u npm_config_proxy -u npm_config_http_proxy -u npm_config_https_proxy -u NPM_CONFIG_PROXY -u NPM_CONFIG_HTTP_PROXY -u NPM_CONFIG_HTTPS_PROXY npm test
```

Relevant exact output:

```text
> test
> node --import ./test/register-wasm-loader.mjs --test test/*.test.js test/*.test.mjs
...
ℹ tests 268
ℹ suites 0
ℹ pass 268
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 3151.317604
```

Exit code: `0`.

### Additional verification

Worker bundling was verified without deployment or external resource mutation:

```bash
tmpdir=$(mktemp -d); npx wrangler deploy --dry-run --outdir "$tmpdir"; status=$?; echo WRANGLER_EXIT=$status; exit $status
```

Relevant output:

```text
wrangler 4.125.0
Total Upload: 1034.79 KiB / gzip: 314.98 KiB
env.BRAND_ASSETS (leadintel-brand-assets) R2 Bucket
--dry-run: exiting now.
WRANGLER_EXIT=0
```

`npm audit --omit=dev` also exited `0` with `found 0 vulnerabilities`.

### Files changed in round 2

- `backend/test/brand-assets.test.js` — decoder probes, audit failure/no-put test, and truthful audit event/order assertions.
- `backend/src/brand-assets.js` — decoder acceptance and pre-put intention audit ordering.
- `backend/src/image-decoders.js` — maintained WASM decoder integration for PNG, JPEG, and WebP.
- `backend/test/register-wasm-loader.mjs` — Node test-loader registration.
- `backend/test/wasm-loader.mjs` — test-only `.wasm` module adaptation.
- `backend/package.json` — exact decoder dependencies and loader-enabled test command.
- `backend/package-lock.json` — new deterministic lockfile; no unrelated direct dependency changes.

### Self-review

- Verified the three malformed probes were accepted by the reviewed implementation and rejected only after authoritative decoding was added.
- Verified the genuine PNG/JPEG/WebP fixtures decode to their literal expected dimensions, including the JPEG fixture containing `FF00` entropy stuffing.
- Verified declared MIME must still match strict container detection and that trailing payload tests remain green.
- Verified dimension checks occur before decoder invocation and decoded dimensions must equal container dimensions.
- Verified `audit` completes before the only upload/import `bucket.put` call.
- Verified the pre-put events say `*_authorized`, not `uploaded`, `imported`, or another completion claim.
- Verified audit failure produces zero R2 objects and no put event.
- Verified all prior security regressions remain in the focused suite and pass.
- Verified Wrangler bundles all three decoder WASM modules successfully using the pinned Worker toolchain.
- Verified no Cloudflare resources were provisioned, inspected, or deleted.
- Verified only the three decoder packages were added as direct dependencies and their resolved graph is captured in `package-lock.json`.

### Concerns and deployment notes

The `leadintel-brand-assets` bucket still requires separate provisioning in the target Cloudflare account, and imports remain intentionally disabled until `BRAND_ASSET_IMPORT_HOSTS` is populated with reviewed exact hosts/origins. No external Cloudflare operation was performed in this round.

Full decode necessarily allocates decoded pixel memory. Inputs remain bounded before decoding by the existing per-kind byte limits and 6000 × 6000 dimension ceiling; exceptionally dense images near that ceiling can consume significant Worker memory and may fail closed. The dry-run bundle is approximately 1.01 MiB uncompressed (315 KiB gzip), including the three maintained decoder modules.

The prior report's orphan concern is superseded: required upload/import auditing now occurs before R2 put, so audit failure cannot create the described orphan.

---

## Review Fix Report — Round 3 — 2026-09-15

### Status and commits

The remaining Worker-memory finding was fixed through RED/GREEN on `codex/brand-email-identity`. `main` was not modified.

1. `3231a7e18e0e96591a47a4565bc905ad116c930c` — `test: expose Worker image memory regressions` (RED)
2. `1e41fe0484fb304ac54c79638a3e42dab39bc6ef` — `fix: bound Worker image decode memory` (GREEN)

### Implementation details

#### Pre-decode memory bound

- Preserved the absolute `6000 × 6000` dimension ceiling.
- Added `MAX_DECODED_PIXELS = 4_000_000`. Container dimensions are checked against this budget before `decodeImage` is called, bounding the decoded RGBA output to 16,000,000 bytes (approximately 15.26 MiB).
- The decoder-level verification remains mandatory for upload and import, and genuine PNG, JPEG (including `FF00` entropy stuffing), and WebP fixtures continue to pass.

#### One-codec lazy loading

- Replaced the eager top-level imports and shared three-codec initializer with MIME-selected dynamic imports in `src/image-decoders.js`.
- Added isolated PNG, JPEG, and WebP codec wrappers under `src/image-codecs/`. Each wrapper imports only its matching decoder/WASM module and initializes that decoder once on first use.
- The integration regression runs each real decoder in a fresh child process and observes loaded WASM modules. Each format loads exactly one matching module.
- Wrangler folds the dynamic modules into lazy `init_png`, `init_jpeg`, and `init_webp` closures; the selected MIME invokes only its corresponding closure.

#### Metadata-only public delivery

- Successful validated writes now add private R2 custom metadata: workspace ownership, validation marker, validated MIME, validated byte length, width, and height.
- Public GET no longer parses or decodes stored image bytes. It fails closed unless the private validation marker and all validated fields are present and valid, the dimensions remain within both limits, R2 HTTP content type matches the validated MIME, the optional R2 object size agrees, and the bytes read exactly match validated length.
- Safe public headers remain unchanged: explicit supported image `Content-Type`, exact `Content-Length`, `X-Content-Type-Options: nosniff`, and immutable caching.
- A child-process regression invokes public GET without the test WASM loader. Success proves the read path does not import or initialize a decoder.

### RED evidence

Exact command from `backend/`:

```bash
npm test -- --test-name-pattern='4,000,000|only the decoder|public GET|uploads use fully random|production app serves public'
```

Relevant exact output:

```text
✖ an image above 4,000,000 decoded pixels is rejected before loading a decoder
✖ only the decoder matching the declared image format is loaded
✖ uploads use fully random uncorrelated IDs and keep ownership only in private R2 metadata
✖ public GET serves validated metadata without loading an image decoder
✖ public GET fails closed when private validation metadata is missing or malformed
ℹ tests 272
ℹ suites 0
ℹ pass 267
ℹ fail 5
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2776.015854
```

Exit code: `1`. The no-loader child processes failed while resolving the eagerly imported decoder WASM, the codec observation found all three WASM modules for a PNG request, uploads lacked validation metadata, and public GET accepted missing private validation metadata.

The selected-codec failure showed the exact mismatch:

```text
actual:   [ 'mozjpeg_dec.wasm', 'squoosh_png_bg.wasm', 'webp_dec.wasm' ]
expected: [ 'squoosh_png_bg.wasm' ]
```

### Focused GREEN evidence

Exact command from `backend/`:

```bash
node --import ./test/register-wasm-loader.mjs --test --test-name-pattern='genuine PNG|4,000,000|only the decoder|upload|public GET|production app serves public' test/brand-assets.test.js
```

Relevant exact output:

```text
✔ genuine PNG, stuffed-entropy JPEG, and VP8 WebP fixtures return decoded dimensions
✔ an image above 4,000,000 decoded pixels is rejected before loading a decoder
✔ only the decoder matching the declared image format is loaded
✔ public GET serves validated metadata without loading an image decoder
✔ public GET fails closed when private validation metadata is missing or malformed
ℹ tests 11
ℹ suites 0
ℹ pass 11
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 824.609133
```

Exit code: `0`.

### Full backend GREEN evidence

Exact warning-free command from `backend/`:

```bash
env -u NPM_CONFIG_NOPROXY -u npm_config_proxy -u NPM_CONFIG_PROXY -u NPM_CONFIG_HTTPS_PROXY -u npm_config_http_proxy -u NPM_CONFIG_HTTP_PROXY -u npm_config_noproxy -u npm_config_https_proxy npm test
```

Relevant exact output:

```text
> test
> node --import ./test/register-wasm-loader.mjs --test test/*.test.js test/*.test.mjs
...
ℹ tests 272
ℹ suites 0
ℹ pass 272
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 3706.288197
```

Exit code: `0`.

### Wrangler dry-run and dependency audit

Exact dry-run command from `backend/` (output directory created with `mktemp -d /tmp/leadintel-wrangler-round3.XXXXXX`):

```bash
env -u NPM_CONFIG_NOPROXY -u npm_config_proxy -u NPM_CONFIG_PROXY -u NPM_CONFIG_HTTPS_PROXY -u npm_config_http_proxy -u NPM_CONFIG_HTTP_PROXY -u npm_config_noproxy -u npm_config_https_proxy npx wrangler deploy --dry-run --outdir /tmp/leadintel-wrangler-round3.YiJa3d
```

Relevant exact output:

```text
wrangler 4.125.0
Total Upload: 1050.35 KiB / gzip: 315.91 KiB
env.BRAND_ASSETS (leadintel-brand-assets) R2 Bucket
--dry-run: exiting now.
```

Exit code: `0`. This was bundling only; nothing was deployed and no external Cloudflare resource was changed.

Exact production dependency command:

```bash
env -u NPM_CONFIG_NOPROXY -u npm_config_proxy -u NPM_CONFIG_PROXY -u NPM_CONFIG_HTTPS_PROXY -u npm_config_http_proxy -u NPM_CONFIG_HTTP_PROXY -u npm_config_noproxy -u npm_config_https_proxy npm audit --omit=dev
```

Exact output:

```text
found 0 vulnerabilities
```

Exit code: `0`.

### Files changed in round 3

- `backend/test/brand-assets.test.js` — pixel-budget/no-decoder regression, real selected-codec load observation, private metadata contract, metadata-only GET proof, and malformed/missing metadata cases.
- `backend/test/wasm-loader.mjs` — optional test-only WASM load observation.
- `backend/src/brand-assets.js` — 4,000,000-pixel pre-decode bound, validated-write metadata, and metadata-only fail-closed public delivery.
- `backend/src/image-decoders.js` — MIME-selected dynamic codec loading.
- `backend/src/image-codecs/png.js` — lazy PNG decoder initialization.
- `backend/src/image-codecs/jpeg.js` — lazy JPEG decoder initialization.
- `backend/src/image-codecs/webp.js` — lazy WebP decoder initialization.

No package or lockfile change was needed in round 3; the exact decoder dependencies pinned in round 2 were preserved.

### Self-review

- Confirmed the 4,000,000-pixel decision is an additional pre-decode constraint and does not alter the returned asset metadata shape.
- Confirmed the dimension ceiling remains exactly 6000 pixels on each axis.
- Confirmed upload/import calls container validation and the pixel-budget check before dynamically importing a codec, then requires a complete real decode before the pre-audited R2 put.
- Confirmed each real genuine fixture loads only its declared PNG, JPEG, or WebP WASM decoder in a fresh process.
- Confirmed public GET succeeds in a process with no WASM loader, proving no decoder import or initialization on reads.
- Confirmed public GET rejects absent validation metadata, unknown validation versions, unsupported metadata MIME, non-numeric/wrong lengths, invalid dimensions, and metadata dimensions above the pixel budget.
- Confirmed public GET continues to enforce stored content type, byte length, safe headers, valid opaque IDs, and the R2 binding.
- Confirmed all five findings addressed in round 1 and both findings addressed in round 2 remain covered by the full passing backend suite.
- Confirmed the implementation commit is a direct child of the RED commit and all remote writes targeted only `codex/brand-email-identity`.
- Confirmed no external Cloudflare resource was provisioned, inspected, modified, deployed, or deleted.

### Concerns and deployment notes

The `leadintel-brand-assets` R2 bucket still must be provisioned separately in the correct Cloudflare account, with the Worker binding named exactly `BRAND_ASSETS`. This task only configures the binding; no Cloudflare resource operation was performed.

Existing objects written by an older deployment without the new `decoded-v1` private metadata will intentionally return 404. If such objects exist, they must be re-uploaded/re-imported through the validated write path (or migrated by a separately reviewed process that performs equivalent full validation) before rollout. This fail-closed behavior is deliberate.

`BRAND_ASSET_IMPORT_HOSTS` remains empty by default and must be populated with reviewed exact hosts/origins before imports are enabled. Direct authenticated file upload remains available.

---

## Review Fix Report — Round 4 — 2026-09-15

### Status and commits

The remaining object-substitution finding was fixed on `codex/brand-email-identity`; `main` was not modified.

1. `942983f944d3a1ac38165b60b02607fc9e5e14c8` — `test: bind public asset metadata to object bytes` (RED)
2. `0b779b2763d9908c451f10db8ab6357ab6c71d1b` — `test: model streamed brand asset reads` (test fixture follows the R2 body contract)
3. `d263a801e213616e186120b721b917556422d950` — `fix: bind brand asset metadata to stored bytes` (GREEN)

### Implementation details

- Validated upload and import writes now compute SHA-256 from the exact validated `Uint8Array` passed to R2 and store its canonical lowercase hexadecimal value in private custom metadata named `content-sha256`.
- Public GET requires `content-sha256` to be exactly 64 lowercase hexadecimal characters, reads the body through a bounded stream capped at the stored validated byte length, hashes those exact bytes, and uses the existing constant-time comparator before returning a response.
- Missing, empty, uppercase, short, non-hex, or mismatched digests return the existing fail-closed 404. Matching genuine bytes continue to return the prior safe MIME, nosniff, immutable-cache, CORS, and length headers.
- The GET path still does not parse or decode images. The stream only retains chunks up to the existing encoded 5 MiB maximum (and normally the validated per-asset limit), so hashing does not reopen the decoded-image memory budget.

### TDD evidence

The behavioral tests were committed before the production implementation.

RED command from `backend/`:

```bash
node --import ./test/register-wasm-loader.mjs --test --test-name-pattern='persist the validated byte digest|same-length substituted|canonical SHA-256|matching digest metadata|production app serves public' test/brand-assets.test.js
```

Result: exit `1`; 5 tests run, 2 passed, 3 failed. The pre-fix implementation omitted `content-sha256`, served a same-length `MZ` substitution with unchanged trusted metadata as `200`, and accepted missing/malformed digests as `200`.

Focused GREEN command:

```bash
node --check src/brand-assets.js && node --import ./test/register-wasm-loader.mjs --test --test-name-pattern='persist the validated byte digest|same-length substituted|canonical SHA-256|matching digest metadata|public GET returns only validated bytes|production app serves public' test/brand-assets.test.js
```

Result: exit `0`; 6 tests passed, 0 failed.

Complete asset-boundary GREEN command:

```bash
node --check src/brand-assets.js && node --import ./test/register-wasm-loader.mjs --test test/brand-assets.test.js
```

Result: exit `0`; 33 tests passed, 0 failed.

Full backend command:

```bash
env -u NPM_CONFIG_NOPROXY -u npm_config_proxy -u NPM_CONFIG_PROXY -u NPM_CONFIG_HTTPS_PROXY -u npm_config_http_proxy -u NPM_CONFIG_HTTP_PROXY -u npm_config_noproxy -u npm_config_https_proxy npm test
```

Result: exit `0`; 274 tests passed, 0 failed, 0 skipped.

Wrangler bundle-only verification:

```bash
env -u NPM_CONFIG_NOPROXY -u npm_config_proxy -u NPM_CONFIG_PROXY -u NPM_CONFIG_HTTPS_PROXY -u npm_config_http_proxy -u NPM_CONFIG_HTTP_PROXY -u npm_config_noproxy -u npm_config_https_proxy npx wrangler deploy --dry-run --outdir <temporary-directory>
```

Result: exit `0`; Wrangler 4.125.0 reported the `BRAND_ASSETS` R2 binding and exited at `--dry-run` without deployment. The environment emitted its existing proxy-detection warning only.

Production dependency audit:

```bash
env -u NPM_CONFIG_NOPROXY -u npm_config_proxy -u NPM_CONFIG_PROXY -u NPM_CONFIG_HTTPS_PROXY -u npm_config_http_proxy -u NPM_CONFIG_HTTP_PROXY -u npm_config_noproxy -u npm_config_https_proxy npm audit --omit=dev
```

Result: exit `0`; `found 0 vulnerabilities`.

### Coverage and follow-up

- Added an upload persistence assertion for the exact SHA-256 metadata value.
- Added a regression that substitutes different same-length bytes while preserving valid-looking image MIME and all prior metadata; public GET fails closed.
- Added missing, empty, uppercase, short, non-hex, and genuine matching-digest public-read cases.
- Existing objects that carry `decoded-v1` metadata but predate `content-sha256` intentionally fail closed until re-uploaded or migrated through an equivalently validated process. The pre-existing bucket-provisioning and reviewed-import-allowlist concerns remain unchanged.
