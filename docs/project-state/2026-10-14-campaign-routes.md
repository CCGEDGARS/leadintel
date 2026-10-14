# Campaign brief, research route and direct writer

Step 1 now saves a campaign brief: name, purpose and companies. It accepts one company with its website, a company/website CSV (optional name/email/title), or existing CRM companies and contacts. Template editing belongs to Step 6.

Two buttons save the brief and select the route:
- **Research recipients first:** opens campaign research in Companies, followed by buyer review. Research is started explicitly, in batches of five, against only the campaign audience. It reuses the existing evidence/fit pipeline and its seller-profile gates. This release does not introduce a new Quick/Basic/Deep research engine or claim a fixed monetary estimate.
- **Go straight to campaign writer:** opens Step 6 without research or contact enrichment. A company-only campaign can write a shared template before named contacts are added. Named contacts can prepare and approve drafts without an email; sending remains held until the existing contact-confirmation policy passes.

Audience selection supports selected companies, first N and the entire source list, with a 500-company limit. Imported/added lists stay separate from the full CRM source; their original source IDs and selection mode persist alongside the selected audience. Entire list is a preparation scope, not permission to send.

The Campaign writer has subject/body templates, template/mode choices, campaign-only contact selection, individual editable drafts, and a selected-recipient Writing Assistant. Assistant proposals require Apply and Save, then fresh message approval. The approved core templates remain unchanged. The campaign purpose accompanies assistant context; deterministic personal templates substitute declared identity fields and verified trigger fields, without inventing research.

D1 migration `0035_campaign_setup.sql` adds metered, workspace-scoped company audience and route/selection metadata. Existing campaign members and messages remain intact. Legacy campaigns infer companies from their members until explicitly saved with setup metadata. Source and selected company IDs are checked against the active workspace; suppressed/archived companies cannot be reactivated by campaign setup. CSV imports never manufacture email verification.

Regression coverage exercises company-only save/reload, no-email drafting versus delivery, selection boundaries, import identity, source-list persistence, direct navigation without research, protected sending, research batches and workspace changes. Production requires the exact-SHA CI/deployment/release-proof chain. An authenticated live-user send is not part of release verification and is not authorized by campaign preparation.
