# Companies and Buyers back navigation — 20 October 2026

The shared stage header displayed “← Companies” in Buyers but bound that button directly to `showStrategyStep`. The visible label and navigation destination disagreed. Authenticated verification reproduced Buyers → Strategy, skipping Companies.

The header now routes by the saved journey focus: Buyers → Companies, Companies → Strategy. Returning from Buyers uses the existing local stage transition and rendering, preserving company research, selections, saved recipients and evidence. Navigation does not start research, reveal contacts, activate automation or send outreach. Explicit “review strategy” actions retain their Strategy destination. The customer entry script gets a new cache key and release verification checks both the handler and entry marker.

The DOM regressions bind the real runtime click handlers and reproduce the original defect before the fix. They cover both back destinations and a Companies → Buyers → Companies round trip with persisted reload, unchanged research and recipient data, and zero provider calls.

The user's mandatory completion rule is recorded in `AGENTS.md`: finish delegated work through its acceptance checks and provide an evidence-backed completion confirmation. Do not stop at a discovered defect when the authorized fix is feasible.

Local verification: all 3,134 customer tests pass with zero failures; JavaScript syntax, production build and `git diff --check` pass. Independent review passed 97 targeted checks and an additional mounted-DOM run using the real page-quality and process-map code. It verified both back destinations, panel visibility, research and recipient preservation through reload, and zero provider calls or runtime errors. No Critical, Important or Minor findings remain. Exact-SHA release proof and authenticated customer acceptance remain separate final gates.
