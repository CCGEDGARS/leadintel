# Writing workspace and three-book content library

Approved: 15 October 2026. Replaces the previous one-material UI requirement.

## Contract
- Editable subject/body in the assistant, isolated from the Step 6 draft until explicit handoff.
- Load an editable copy from every core style, personal style and saved template, or current draft. Preview before loading; replacement requires explicit confirmation when there are edits.
- Shorten, Strengthen persuasion, Personalize produce proposals from the unchanged working draft. Optional instructions augment the action. Apply, Undo and Restore original are explicit.
- Save as template uses the existing reusable-template review and persistence. Use in current flow saves the draft into Step 6, without approving or enqueueing delivery.
- Three private slots with one active Ready source. Book-shaped covers, title, editable description, status, upload/delete, replacement cover. PDF first-page cover is rendered locally. No usable cover uses a title fallback. Source selection cannot change the current draft.
- Preserve extraction review, file size/page limits, tenant authorization, quota accounting, stale revision checks and source grounding. Cover and display metadata are not factual evidence.

## Verification
Focused controller/UI and backend lifecycle tests, source selection races, invalid uploads, metadata quota, full existing suites/build, local browser desktop/mobile fixture with mocked providers. No actual email or paid AI generation during testing.

## Release
Database migration 0036 adds presentation metadata and its quota accounting. Deploy migration/backend before frontend. Existing sources/drafts are retained; rollback frontend/backend leaves additive metadata unused.

## Implementation and evidence

- August CRM baseline reviewed: Step 6 durable saves still use the canonical CRM script package; unsaved assistant work uses account-aware, workspace/buyer/channel-scoped device recovery. This feature replaces the later one-book UI rule and the former direct-apply quick actions. The protected source texts are unchanged.
- Load script offers the canonical reference pattern for all four email styles, saved personal templates, personal style revisions, the current draft and corresponding LinkedIn styles/templates. Loading never changes the master or Step 6 draft.
- Apply validates source freshness, links, identity and event requirements, then changes only the assistant draft. It cannot approve, enqueue or send. The existing CRM save and template-review paths are reused for explicit final actions.
- PDF first pages are rendered locally through the existing PDF.js bundle. Uploaded raster replacement covers are resized locally and converted to JPEG. Private display metadata is revision-controlled, size bounded and quota accounted; SVG, external image URLs and foreign-workspace edits are rejected. Existing books without a thumbnail retain the generated title cover until a replacement cover is added.
- Source selection is exclusive in the backend and database. Migration keeps the first active slot if older data contains multiple active books, preserving every file. All later activation changes are atomic and invalidate stale generation references.

Verification: full customer suite 2,692 passed, zero failed/skipped. Full backend suite 638 passed, zero failed/skipped, followed by the expanded four-test library suite including the new migration preservation/exclusivity test. After the final canonical-picker and template-review focus adjustment, all five actual outreach adapter tests passed. Build and diff whitespace checks passed. No new package dependencies, customer writes, paid generation, delivery or campaign launch.

Native visual acceptance remains BLOCKED: Playwright has no installed browser executable and the official Chromium download returned an invalid/empty archive. The available cloud browser cannot reach the local fixture server; the subsequent error-tab access was rejected by its URL policy, and no workaround was attempted. DOM interaction tests do not prove desktop/mobile pixels or actual PDF cover rendering. The isolated fixture at customer/test/fixtures/writing-workspace.html exercises the real components with simulated providers; build packaging excludes all test fixtures. Review it with a local development server at desktop and mobile widths before production promotion. Fresh paid AI-output quality and cross-device acceptance are not claimed.

Release status: source implementation only; this document does not establish production deployment. Database migration/backend must precede frontend promotion. Any future release requires exact-SHA CI, manifests, health and mandatory smoke proof under the repository release-integrity rules.
