# Mandatory page procedures

The application owns the checks. `customer/page-quality.js` coordinates fresh page adapters; the existing Profile, Strategy, Discovery, Message Editor, Events, Delivery and CRM modules retain their authoritative validation. An AI reviewer is not needed to determine whether saved inputs, evidence references, template assembly or an approval match. This layer does not establish external factual truth or verify that a provider delivered an email.

## Opening and action contract

1. Identify the active page and authenticated workspace; reject unresolved synchronization or unreadable state.
2. Read current inputs through that page's adapter. Missing modules or missing required inputs cannot produce Ready.
3. Run only the existing safe opening operation, where registered. Messages can verify the saved buyer handoff and prepare their existing tailored message; CRM can read its current records. Opening never starts new company research, saves or approves a script, activates automatic delivery, or sends mail. Existing message field preparation may use the previously authorized bounded AI path when the chosen core template needs it. The readiness checks themselves make no AI or provider calls.
4. Re-read actual results. Show Ready, Preparing, Needs review or Blocked and the first relevant next action. Checks are expandable, with one status panel per surface.
5. Before a critical action, read the inputs again and apply its specific gates. Ready from a previous check cannot authorize an action. During asynchronous send preparation, compare the complete captured context again before contacting the provider and again before recording its response. A confirmed send whose context changed is reported explicitly for review in the original workspace; it cannot write into the new workspace. A copied or fabricated operation ticket is rejected.

Opening errors remain blocked until reopening succeeds. Opening preparation is bounded to ten seconds for the status coordinator; underlying operations retain their own cancellation, timeout and scope guards. Late completion cannot publish a receipt into another workspace or a newer page. A workspace load or synchronization completion retries the active page, including an open CRM dialog.

## Page responsibilities

| Page | Checks and preparation | Critical action scope |
| --- | --- | --- |
| Setup | Website, target markets, existing website activation | Continue to Profile |
| Profile | Required research confirmations, all message confirmations, targeting confirmation, generated profile | Analysis, confirmed research start, profile approval |
| Strategy | Approved profile, active customer definitions and buying signals, canonical strategy handoff blockers | Activate strategy and continue |
| Companies | Confirmed seller/targeting, canonical strategy, current discovery state, qualified or selected results | General research, targeted research with its existing exception, progression readiness |
| Buyers | Selected company, actual identified people, confirmed current workspace/company/person selection | Buyer research and progression readiness; existing contact evidence and consent gates remain authoritative |
| Messages | Saved buyer handoff, reviewed seller, sender, current settings, source-backed trigger, controlled template assembly, event details, placeholders, editor state, exact saved text and approval | Generate/update, templates/default, approval, flow and manual sending |
| Delivery | Approved package, exact approved subject/body, current buyer email, freshness and duplicate send record | Open Gmail draft, send Gmail or Microsoft; human confirmation and backend policy remain required |
| CRM | Current authenticated workspace list and selected loaded record, transport and busy state | CRM actions; current workspace checked again before saving delayed buyer-search results |

Checks are action-scoped. An unsaved draft may be edited and saved, but cannot enter templates or flow or be sent. Required research answers and the twelve message confirmations remain distinct. Targeted company research retains the canonical exception rather than inheriting all general discovery requirements. A failed advisory check does not grant permissions and does not block unrelated allowed work.

## Message authority and preservation

Opening Messages uses the current confirmed recipient, seller information, selected verified trigger and chosen/default template. Approved core English output is compared against deterministic assembly of the immutable reference and its permitted factual slots. Subject choices follow the existing facts and availability rules. Unsupported facts are not invented. A raw selected trigger whose URL, company or excerpt no longer matches reviewed dossier evidence blocks approval, flow and sending.

A deliberate manual copy, explicit rewrite, personal template or translation retains its existing separate authority and validation. Checking does not rewrite it into a core template. Existing opening preparation preserves saved/manual/approved/translated work and proposes an update. Update message remains an explicit action with the established first-original, Undo and subsequent Save rules.

An applied event invitation retains its own campaign. Any change to that saved campaign's semantic fields requires Update, even when its name, dates and stand remain unchanged. Archived or invalid campaigns fail closed. The checker never selects a different active event in place of the applied one.

## Isolation and internal receipts

Receipts and operation tickets exist in memory. The audit trail keeps at most thirty changed check results: page, workspace ID, procedure version, change fingerprint, state, check IDs/statuses and timestamp. It stores no email content, source excerpts, contact names, credentials or provider responses. No schema, CRM table or workspace JSON payload is added. Workspace changes clear receipts and the audit trail. Send tickets compare complete private input keys; the short audit fingerprint is only a change detector.

CRM clears previous-workspace records before loading a new list. Existing request counters and workspace guards protect lists, company details and activities; delayed buyer search cannot save contacts into a changed workspace or selected record.

## Verification boundaries

Regression tests exercise actual DOM capture, safe opening, invalid storage, confirmations, template preservation, event/source changes, workspace switches, fresh critical gates, sticky opening failure, bounded/private receipts, and delayed manual-send preparation. Exact-SHA production verification requires the new engine, UI, CSS and connected guards as mandatory smoke checks.

Production asset/health proof is separate from authenticated customer acceptance. A Ready status means current declared checks passed; it is not proof of a new web search, CRM durability beyond the canonical save acknowledgement, provider delivery, or real customer workflow acceptance.
