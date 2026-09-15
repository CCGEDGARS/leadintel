# SDD ledger — plan: docs/superpowers/plans/2026-09-15-brand-email-identity-implementation.md

Workspace: remote isolated branch `codex/brand-email-identity` at base `633a470fff847b64eeb19bf1fb687600ca550bfd` because the available local checkout is a partial non-git export.

Ruling: Use the remote feature branch as the isolated workspace — local git credentials are unavailable, while the connected GitHub app supports branch-scoped writes — cost if wrong: tests must execute through repository CI or reconstructed focused local files rather than a conventional worktree.

Preflight interface scan:

| Tasks | Shared file/interface | Finding |
|---|---|---|
| 1 → 3 | `LeadIntelBrandIdentity` normalization/rendering | Clean: UI consumes Task 1 API. |
| 1 → 5 | `snapshot` and `renderEmail` | Clean: outreach consumes immutable snapshot API. |
| 2 → 3 | brand asset endpoints | Clean: UI consumes server APIs through Task 4 bridge. |
| 2 → 4 | asset route and bridge methods | Clean: endpoint and method naming align. |
| 3 ↔ 4 | `main.brandIdentity` and bridge calls | Clean: metadata persists in existing main state; bytes do not. |
| 4 → 6 | `textBody` / `htmlBody` send contract | Clean: bridge maps camelCase to backend snake_case. |
| 5 → 6 | approved snapshot rendering | Clean: manual sender receives deterministic output. |
| 2 ↔ 7 | R2 binding and deployment | Risk: production bucket provisioning may require owner-side Cloudflare action; implementation and test can complete independently. |
| Task 1 | tests vs implementation | Clean. |
| Task 2 | tests vs implementation | Clean. |
| Task 3 | tests vs implementation | Clean. |
| Task 4 | tests vs implementation | Clean. |
| Task 5 | tests vs implementation | Clean. |
| Task 6 | tests vs implementation | Clean. |
| Task 7 | release proof | Clean subject to external R2 provisioning. |

Task 1: fix round 1/5 (3 addressed, 0 open; commits `5d67f72..4e1bab4`).

Task 1: minor (deferred): top-level identity `updatedAt` is normalized but not validated; final review should decide whether this metadata needs strict validation.

Task 1: complete (commits `633a470..4e1bab4`, review clean after fix round 1).

Task 2: Ruling: server-side website image imports require exact configured `BRAND_ASSET_IMPORT_HOSTS`; direct file upload remains universal — closes DNS-rebinding SSRF at the cost of configuring approved source hosts before extraction imports work.

Task 2: fix round 1/5 (5 original findings addressed, image decode and orphan leak remained; commits `3007698..0000aab`).

Task 2: fix round 2/5 (decoder and audit-order findings addressed, Worker memory risk remained; commits `0000aab..52632bf`).

Task 2: fix round 3/5 (memory/GET decode finding addressed, byte-integrity binding remained; commits `52632bf..81242f7`).

Task 2: fix round 4/5 (digest binding addressed, 0 open; commits `81242f7..9867003`).

Task 2: minor (deferred): public GET `getReader()` acquisition failure propagates rather than returning 404; fresh R2 bodies are not expected to be locked.

Task 2: complete (commits `4e1bab4..9867003`, review clean after fix round 4; 33 focused and 274 backend tests passing).

Task 3: fix round 1/5 resolved real evidence extraction, keyboard upload controls, accessible validation, model/HTML length limits, stale previews, HTTPS-only suggestions, and complete tab semantics (`5c805d6..80995f6`).

Task 3: fix round 2/5 wired production evidence, bumped assets, and consumed imported logo suggestions (`80995f6..843188d`).

Task 3: fix round 3/5 preserved validated Firecrawl logo/colour metadata through the actual scrape-to-suggestion path (`843188d..daaa3d4`).

Task 3: fix round 4/5 atomically bumped all changed runtime assets to cache key `20260915-brand-identity-v3` (`daaa3d4..0b9c269`).

Task 3: complete (commits `9867003..0b9c269`; RED baseline confirmed, final affected suite 45/45 passing; independent review PASS at exact head; Vercel status successful).

Task 3: interface boundary preserved: all asset calls are isolated in `createAssetAdapter`; absent Task 4 server methods produce a clear unavailable error, and failed replacements leave prior managed metadata unchanged.

Task 4: complete (commits `0b9c269..829c89b`; production-composition suite 91/91 passing; independent review PASS with no findings).

Task 4: persistence boundary uses per-operation save intent, one workspace save queue, exact-payload dirty generations, mutation-only rollback, request-time reset generations, retryable cleanup, and save-first/delete-after asset removal.

Task 5: complete (approved outreach freezes immutable brand snapshots; manual preview and delivery share deterministic rendered content; automatic handoff remains plain text).

Task 6: complete locally on top of rebased head `a9211c6` (47 focused and 299 full backend tests passing; backend-only write set; pending atomic branch commit).
