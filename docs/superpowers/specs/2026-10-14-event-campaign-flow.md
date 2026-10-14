# Shared event and campaign flow

Reuse Profile → company research → buyer discovery → messages → delivery/CRM. Move event and email setup to the bottom of Profile (Step 2). Both remain optional and closed unless the user opens them. Seller answers prefill empty targeting fields without overwriting edits.

Recipient sources: supplied companies/contacts, system discovery, or supplied list plus discovery. Persist desired company count, contacts per company, research depth and source choice. Supplied companies remain available even with weak fit; discovered additions require existing qualification. Missing results must be reported as a shortfall. Direct route makes no research calls and never asserts attendance. Both paths require explicit message review and separate delivery authorization.

Events support participant/outside/both audiences, multiple public source URLs, country/city and venue, registration/cost/pass facts, a reason to attend separate from meeting value, timezone/duration, optional draft save, and conditional meeting fields. Reuse email campaigns for event recipient lists and bulk delivery, linked to the saved event ID. Server-side event drafts use the current saved event and evidence; source fingerprint includes event revision/evidence so changed facts revoke authorization. Generic core templates remain untouched.

Attendance: unknown, company listed (person unconfirmed), person explicitly confirmed for this edition. Source URL, excerpt, check date and exact event edition required. Discovery stores supported company-level evidence; never infer individual attendance from company listing. Writer shows evidence and uses distinct participant vs outside wording. Restricted or absent lists remain a reported evidence gap.

No research or sends run on activation alone. User can continue to research or Step 6. Existing message originals, CRM identities, workspace isolation and suppression gates remain intact.
