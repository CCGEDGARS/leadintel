# Large company-research persistence

The authenticated acceptance run for Strategy → Companies on 1 November 2026 completed six market queries, resolved eleven domains, read 27 pages and accumulated 108 evidence pages before `saveDiscovery` raised a native `QuotaExceededError`. No new qualified companies had been retained. Three previously checked companies stayed available. PR #791's exact production proof passed, but that release did not establish successful company-research completion.

## Cause and fix

The local codec skipped compression for any section above 8 MB. Discovery repeats source bodies across raw results, candidates and research contexts, so a bounded search could cross that threshold and attempt a raw JSON write into the roughly 5 MB browser allowance. Existing cloud fallback could also truncate evidence copies after the lossless compressor declined an expanded section above its bound.

Canonical JSON now shares repeated nested sources before local LZW compression. Reopening reconstructs the exact original string; noncanonical JSON uses the legacy exact-text codec so whitespace and escapes stay intact. The existing 500 KB manifest ceiling and 8 MB record-transfer ceiling remain unchanged. Only expanded Discovery receives a bounded 32 MB allowance; other sections keep 8 MB. Bundle expansion, node/depth counts, legacy reference limits and malformed/cyclic-reference rejection stay enforced. No source, buyer, history or manual field is removed to make the data fit.

The account codec fence advances to `li2:` before authenticated work starts. Older tabs cannot read/write incompatible local frames. New-format writes fail closed if the account guard is stale. Synchronous entry assets, the persistence import and codec worker imports receive matching cache invalidation. The backend health reports the codec revision and decoded Discovery allowance. Research status distinguishes failed browser persistence from unavailable provider checks.

## Verification

Behavioral regressions reproduce a 108-page checkpoint above 8 MB failing the native quota before the fix, then saving/reopening exactly within it. A cloud round trip preserves every original source and selected company while remaining below 500 KB. Other checks cover noncanonical text, older-writer rejection, over-limit expansion, account/workspace transitions and the existing section/recovery contracts. Final suite/release evidence belongs to the follow-up PR; fixture success does not establish authenticated research yield.

The first acceptance tab was kept open during implementation. New production acceptance must verify research completion, saved results and a reload without automatically repeating provider work. Retained earlier evidence must remain distinct from newly acquired/qualified companies. No contact-credit purchase or outreach is authorized by this fix.

Rollback requires a codec-aware reader: retain the new reader/account fence until any new local frames have been migrated. Do not restore an older browser decoder over active new-format sections. Existing legacy frames remain readable.

## Acceptance follow-up: Strategy save deadline

Release `94abf18f76c81450efca093aabf294723ae82e2b` passed exact production proof (577/577 smoke checks). Authenticated research completed with 8 checked companies, showing the requested top 5; the run used 98/200 Firecrawl calls and retained 259 evidence results. A full reload restored identical company headings and the entire Boliden evidence card without starting another search.

Repeating Continue then exposed a separate 10-second Strategy wrapper deadline. The existing save pipeline may legitimately spend up to 15 seconds acquiring the save lock, 30 seconds packing, 30 seconds on the request and 30 seconds storing the acknowledged recovery snapshot. The wrapper could report failure and revoke approval while the underlying save was still succeeding. Its bounded envelope now allows 120 seconds; all component deadlines and the requirement for a positive save acknowledgement remain. A controlled-clock regression proves an acknowledgement after eleven seconds opens once, while a hung save still fails closed and a late acknowledgement cannot navigate or start research. The follow-up must verify the actual repeat-button action against the retained large workspace.
