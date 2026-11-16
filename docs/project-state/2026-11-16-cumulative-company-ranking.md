# Cumulative company scores and ranking

Owner request: new researched companies receive company-fit scores and join the existing saved ranking; a higher score ranks above a lower one. Show the top ten, expand the remainder, and report one deduplicated total. Previously the current checked shortlist used the requested search amount as its display limit, while review records hid company-fit scores.

Acceptance:
- Derive one domain-deduplicated view from saved discovery results, pending review and selected companies. Preserve source data, evidence, selections, buyer contacts and outreach.
- Rank assessed company-fit scores descending across searches. Prefer a current matching assessment over an older copy of the same company; a newer lower assessment replaces an old higher assessment rather than preserving the maximum.
- Show ten rows independent of the search goal, with all remaining rows collapsed by default and expandable without research or persistence writes.
- Every row exposes its score status: current company fit, previous score needing review, or awaiting score when no assessment exists. Never invent a score from an unresearched name or opportunity score.
- Preserve current manual/automatic qualification and Buyers gates. A displayed historical score does not qualify a company or trigger enrichment.
- Show unique total, shown, remaining and review counts. Verify score changes/new arrivals, aliases, repeated discovery, interrupted results, save/reopen, stable action ownership and narrow viewports.

Use existing scoring and result-merging owners; this changes presentation and score retention, not research budgets/providers. Verify focused regression cases, the complete frontend suite, native authenticated SQL/browser persistence, build, independent review and exact-release production proof. Real workspace inventory remains separate from controlled fixture counts.

Implementation retains one pure display snapshot over existing saved owners. Domain aliases count once. Dedicated review scheduling keeps its original stored order; score sorting affects display only. Both checked-card and review-card controls bind the displayed raw owner, reject an overtaken owner and recheck that owner after CRM acknowledgement. Selected-company qualification refresh uses the same winning assessment, including its newer qualification timestamp instead of an older website-read timestamp. Search amount, request budgets, qualification and enrichment/send permissions are unchanged.

Native acceptance uses a controlled workspace with real authentication/HTTP/SQL, fifteen unique companies (ten visible plus five disclosed), a new 99-point assessed arrival, nonempty saved approved-unsent message text and original buyer contact fields. It verifies browser reopen, mobile overflow and zero provider calls. Derived buyer-review metadata may normalize on loading; identity/contact and protected message text are compared separately from those derived fields. Full local suites, independent review and exact-release proof are recorded outside the source tree.
