# Public-first buyer discovery — 2026-10-02

## Authorized behavior
Research a wider pool with target 20 relevant candidates; show no more than six. Apollo is optional and reserved for approved contact enrichment. Gmail reads “Not found” when absent and displays a sourced address without adjacent status text when found. Evidence and unverified state remain internally retained; Gmail is not automatically eligible for outreach.

## Root causes and changes
Previously initial discovery required Apollo and truncated results to four before public research. Name-derived Gmail pattern queries could miss publicly listed non-pattern addresses. Saved normalization also truncated every buyer list to four.

Discovery now verifies the company website, searches public profile evidence per workspace-derived role and runs authenticated grounded OpenAI discovery across company, association, news and profile sources. Only full names with explicit company employment attribution and matching roles enter the ranked pool (maximum twenty). Former-role excerpts and unrelated media/industrial roles are rejected. Up to six recommendations retain individual public contact research; the wider pool and research coverage survive save/reload. Existing full-name leads are reassessed against the active roles. No Apollo call occurs during initial public discovery.

Approved enrichment resolves a public buyer to exactly one Apollo identity by profile URL or exact full name before enriching. Public CRM contacts retain public_research provenance. Discovery and loader cache versions change for this release.

Gmail search runs grouped pattern evidence searches plus an explicit full-name/company/@gmail.com query. Non-pattern Gmail listings need the name and company close to the address and a valid public source URL; pattern guesses and unrelated names never display as findings. Missing/failed provider coverage remains in research diagnostics. Found Gmail text is not a deliverability claim. No Google account login or Gmail inbox access is involved.

## Verification and limits
Customer regression suite: 1,415 passing at initial full verification. New regressions cover twenty/six caps and reload, legal/industrial portability, former/media rejection, arbitrary sourced Gmail discovery and exclusion of guessed Gmail displays. Backend suite and exact-SHA release checks must pass before production claims.

Twenty is a research target, not a guarantee. Public indexing can omit genuine buyers; explicit attribution is intentionally conservative and current roles still require review. Provider execution for the authenticated Polestar workspace has not been observed in this release; signed-in customer acceptance remains distinct from mock/runtime tests and public release verification. No outreach is sent.
