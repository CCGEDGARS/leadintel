# Workspace language consistency — 24 September 2026

## Product rule

The core workspace keeps its interface and generated content in English. Campaign Studio owns language selection for outbound campaigns; its localization remains explicit and blocks approval when provider output is missing or invalid.

## Changes

- Added one shared `workspaceContentLanguage()` policy and used it in Market, Discovery, the generated dossier and Delivery learning.
- Removed stale Discovery and Delivery listeners for the retired global-language event. Their previous fallback forced Latvian even when the rest of the workspace was English.
- Kept Campaign Studio's per-campaign language choice and approval checks intact.
- Updated the older selected-language audit note to mark it as superseded by the current product contract.

## Verification

- 1,053 customer tests and 343 backend tests pass.
- The isolated static build, JavaScript syntax checks, and `git diff --check` pass.
- No real provider request or production deployment was performed.
