# Company website and supporting material ingestion — 2 November 2026

## Defects reproduced

Website activation called a legacy cross-origin proxy and depended on the deferred optional router to attach the workspace and first-party session. Its 25-second client deadline could interrupt the backend extractor/fallback chain. It accepted cross-domain redirects and HTTP error content wrapped in a successful response.

Uploads were wired through the main app module rather than their own component. Readable PDF text was rejected when no AI provider was connected, OCR could not recover every sparse/visual page, or the strict AI evidence summary failed. Every cause became the same generic error. Ready material evidence was consumed by writing but never loaded into the company profile preparation path.

## Result

- Activation calls the authenticated first-party workspace extraction endpoint directly, with the existing bounded public-first extractor chain and a 60-second client deadline. The backend's actual execution trace remains authoritative. Foreign redirects and error/access-check pages cannot activate a company. Existing evidence, startup/context guards and save error reporting remain intact.
- The materials component owns file-selection and drop events in capture phase; legacy listeners cannot double-submit. Originals, ticket authentication, quotas, deduplication, revision checks, leases and workspace boundaries remain intact.
- PDF extraction works independently of AI connections. OCR still attempts customer-owned providers for images and sparse pages. Readable passages remain available with explicit partial coverage when recovery fails. If AI summary validation fails, a deterministic excerpt-only result becomes Ready, identifies its mode, and invents no customer, solution or result. Completely unreadable material remains Needs attention. Errors show safe actionable categories without provider bodies or secrets.
- The authenticated `/api/company-materials/profile-context` route supplies bounded readable text with physical page/image locations and material revisions. A shared 60,000-character content budget covers all fifteen supported files. Per-file/page samples are marked partial.
- Profile research, saved-evidence synthesis and the twelve-answer adviser load this context, preserve unrelated inputs, and reject changed account/workspace/input context. Revisions are rechecked after AI and before applying adviser suggestions. Deletion/retry cannot silently publish an old material-based draft. Profile normalization preserves managed IDs/revisions across reload. Legacy file cards do not duplicate managed server cards.
- Writing continues to retrieve only relevant validated source excerpts through its existing backend material-selection and revision guards. Protected outreach masters and sending permissions are untouched.

## Verification

Regression tests reproduce the old failures before the fix and cover first-party activation before optional router startup, redirect/error rejection, selected/drop uploads, readable PDF recovery without credentials, unreadable scans, originals, authenticated profile context, material-to-profile AI context, and deletion/revision races. Existing company-material/context, activation, adviser, research and profile suites are required. Full customer/backend CI, Worker build, static build and exact-SHA release proof remain release gates. Synthetic fixtures prove behavior; they do not prove an unavailable customer's particular brochure was recovered.
