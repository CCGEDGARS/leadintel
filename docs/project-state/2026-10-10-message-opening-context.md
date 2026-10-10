# Message-page opening audit — 10 October 2026

The user requested automatic preparation when Messages opens: a selected main trigger, approved reference-level email, current factual subject choices, and personalization for the active seller and confirmed recipient.

## Root causes and correction

The module-open handler rendered before automatically selecting a trigger. If Profile confirmation or another preparation gate blocked the email, the selected evidence was persisted but not rendered. The handler also retained an earlier automatic choice on reopening instead of re-ranking it for current seller/recipient relevance. The confirmed buyer handoff and module navigation now share `prepareMessageOnOpen`: validate the handoff, refresh automatic evidence selection, render, then prepare the email. Manually reviewed choices and approved drafts are preserved.

`selectedContact` previously read only cached dossier people. It now overlays the current kept pipeline buyer's identity/role only when company domain, person ID and the confirmed handoff match. A different company or an unkept person cannot overlay the saved recipient. This supplies current identity to trigger ranking, message context and recipient rendering without rewriting the historical dossier or saved message.

## Verified behavior and limits

New integration regressions execute the actual module-open handler and preparation functions. They cover all four protected styles, current evidence and factual subjects, selection rendering with blocked preparation, automatic re-ranking, reviewed-selection protection, saved-draft proposals, current kept identity/role, company isolation and a second healthcare seller/recipient without industrial-example leakage. Existing field-preparation race, immutable master, persistent Undo, CRM reload, default snapshot and event tests remain mandatory.

First or untouched controlled drafts prepare automatically from current saved verified evidence and confirmed Profile settings. Saved/manual/approved/translated drafts remain exact; changed context yields a proposed update, accepted via Update message. Core wording, order, spacing and ceilings remain deterministic. Missing evidence never creates an event; unsupported subject patterns stay disabled. Opening does not research new facts, save, approve, send, or activate a flow. Applied event invitations retain their separate approved update action. An authenticated LKAB session was not manipulated in this audit. Exact-SHA release integrity is required before production claims.
