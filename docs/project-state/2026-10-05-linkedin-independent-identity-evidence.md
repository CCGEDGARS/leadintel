# LinkedIn evidence retention — 5 October 2026

## Root cause

Public profile matching retains the original official company identity source. The automatic LinkedIn rule only recognized Apollo-provided profiles or a profile equal to that original source. A unique name/employer profile acquired later therefore had its URL preserved while its matching evidence was discarded. Joakim Winsa reproduced the inconsistent review status: accepted LKAB identity and official contact source, followed by a direct public LinkedIn profile.

## Fix and boundaries

Retain a bounded independent LinkedIn identity evidence record when the existing matcher accepts a unique profile. Bind it to the exact normalized URL, full name, employer and acquisition time. Automatic confirmation still requires buyer eligibility, confirmed identity, matching employer, and the unchanged bound profile/name/employer. Preserve evidence through durable normalization, CRM research snapshots and same-profile refresh. Keep identity and provenance atomic during conflict merge. Bare URLs, ambiguous profiles, qualification holds and mismatched identities remain unconfirmed.

Existing records whose acquisition evidence was discarded are not retroactively labelled automatic merely because a URL exists. Joakim's exact profile was independently checked against public LinkedIn search evidence (Section Manager at Transformation Projects, LKAB), then confirmed through the authenticated existing review flow. This is a manual review; no message generation, outreach send or paid contact lookup is involved.

## Regression validation

Tests reproduce the original official-source/late-profile failure; cover save/reload, changed name/employer/URL, ambiguity, refresh, CRM reconstruction across three customer industries and concurrent provenance conflicts. Record release proof and authenticated confirmation persistence separately from local test success.
