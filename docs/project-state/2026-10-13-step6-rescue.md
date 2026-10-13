# Step 6 rescue — 13 October 2026

The owner requested a dedicated parallel rescue team to implement the agreed Messages experience, following the four screenshots supplied at 08:43 Riga. Baseline is `f4a9d4a732b09a21489c8dee1d2fc8d68dd96fa7`. Layout, Writing Assistant, follow-up backend, follow-up frontend and QA received separate file ownership; the coordinator owns integration and release verification.

## Implemented experience

- Message-first full-width composition with compact recipient/sender and buying-trigger context, horizontal responsive style choices, aligned collapsed Sender & settings / Languages & translations, and an editor sized to its actual content rather than an internal scrolling window.
- One Writing Assistant instruction surface containing the existing explicit Shorten / Rewrite / Reset actions, contextual conversation, optional selection of activated materials, Apply / Discard proposals and a shared expanded session. The duplicate Sources upload panel is removed from the assistant; the existing private reference facility stays available in Tools.
- One collapsed Follow-Up Assistant immediately after the first-contact draft. It reads the active recipient's actual sent CRM/mailbox history or explicitly confirmed manual sent context, analyzes a pasted reply, and prepares a distinct editable follow-up. Separate no-reply mode requires confirmed last-contact date, complete chronological evidence, frequency eligibility and suppression checks.
- Follow-ups support Professional, Diplomatic, Direct and Consultative styles. Interest, questions, objections, referrals and timing requests receive evidence-based suggestions; declines/opt-outs stop further drafting, and out-of-office/ambiguous replies prompt appropriate review/waiting. AI classification is a suggestion, not verified buyer intent.
- Follow-up Save uses a separate workspace/contact-scoped CRM activity. It never modifies, approves or sends the first-contact message. Analysis ownership/history is checked again on Save; repeated identical saves are idempotent. Saved follow-ups reopen without overriding current unsaved work during a history refresh.
- Templates, default configuration, reference materials and advanced campaign/research controls remain accessible in one collapsed Tools drawer. They retain their existing IDs, listeners and records.
- Event invitation controls appear for an active event or an already applied invitation; ordinary messages are not accompanied by a generic event panel. Event drafts and restoration of business drafts remain independent. Existing event AI tailoring is preserved; no nonexistent approved event-script library is claimed.

## Recurring short Professional script — root cause and correction

Four legacy actions (`buildDossier`, `regenerateDrafts`, `confirmOutreachLanguage`, `applyCampaignToCurrent`) could replace the entire first-contact draft with `buildOutreachDrafts`' generic short email while retaining Professional/editor metadata. This is an actual automatic replacement path; an Edited working copy badge does not prove a customer rewrote it.

Those actions now prepare auxiliary scripts only, preserving current email/LinkedIn text, original snapshots, provenance and unsaved typed edits. New email fields stay blank until the deliberate style/Update operation. Core styles use the deterministic approved renderer; AI Original remains separate. No protected master wording changed.

Busy/saving/preview states no longer manufacture manual provenance. Only actual text changes during explicit Edit get manual provenance; fresh AI generation has its own origin. Historical short messages remain preserved and can be restored by an explicit core style/Update action, with recovery and explicit Save.

## Safety and context boundaries

Follow-up context is server-resolved from an owned company/contact and confirmed sent records. An unsent composer is never treated as a previous sent message. Workspace membership, recipient/contact identity, suppression, chronology, bounded text, model output and encrypted short-lived analysis provenance are enforced by the server. Provider usage uses only the customer's configured integration; mount/render never starts paid generation.

Existing automation replies and stored Gmail replies must be included by their actual owned sequence/thread/message associations. Synthetic CRM summary text is not evidence of a buyer reply. Bounded-history limitations fail closed or expose an explicit window; silence is never inferred from a missing/truncated history.

The first-contact master, five subject categories, language versions, event drafts, Save/approval boundaries, source activation and cross-account isolation remain governed by `docs/policies/core-template-ai-rules.md`.

## Verification and actual acceptance limits

Mounted tests exercise all four canonical styles and five subjects, the four legacy bypass handlers, unsaved edits, exact CRM save/reopen, personal overrides, Reset, single controls, blank asynchronous preparation, source-panel ownership and follow-up separation. Frontend/backend wire tests use the actual context/prepare/token/save functions, including date-only manual context, no-reply confirmation and separate saved-draft reopening. Provider requests are mocked; no email is sent or paid generation consumed by these tests.

Responsive layout/autoheight is tested with mounted DOM/CSS rules. Cloud-browser access returned `Emulation.setFocusEmulationEnabled` protocol timeouts, so these tests do not establish actual browser pixels or a real authenticated ERCON journey. Report visual/live acceptance separately from CI and exact-SHA production proof.

Release checks require the new entrypoint/cache versions, message-first assets, integrated assistant, follow-up assets, private endpoint denial and backend follow-up version. Production status still requires both exact-SHA CI suites, deployment success, matching release manifests/health, every mandatory smoke gate and a PROVEN proof artifact.

Local verification completed before publication: full customer suite 2,549/2,549; governed Step 6 checks 373/373; combined assistant tests 46/46; backend suite 593/593 plus final combined-size/Unicode regression checks; Python extraction checks 4/4. Static build, Worker bundle dry-run and dependency audits passed with zero vulnerabilities. Follow-up history tests cover actual stored replies, earlier opt-outs outside the AI window, combined-size token save and Unicode byte limits. Release-contract tests pass 47/47; exact-SHA release evidence is recorded in CI/release proof.

## Customer screenshot acceptance correction — 10:12 Riga

The owner rejected the initial rescue presentation: the previous incorrect Professional working copy remained visible, the main book upload facility was buried in Tools, and Follow-Up was above Writing Assistant with inconsistent padding. Technical production proof did not establish customer acceptance. The earlier completion statement was premature.

Corrected order is editor → Writing Assistant (one visible Add a book or material disclosure with the existing private upload/activation/role/instruction facility) → Follow-Up Assistant → Tools. Duplicate book guidance controls remain inside optional custom-style settings. Follow-Up styles are scoped to the actual host so global summary styles cannot remove the intended padding.

Historical working content is preserved on reopen. The editor now compares English core working copy to canonical assembly and offers explicit Restore approved [style], without claiming historical metadata proves manual editing. Restore clears a personal/default selection, reassembles the protected core, retains prior text in Undo/history and archives a corrupted same-scope original before establishing the canonical Reset baseline. Save remains explicit. Events, LinkedIn and translations retain their own boundaries.

No stronger model was needed for these corrections: the failures concerned presentation, existing saved state, original-snapshot recovery and premature acceptance reporting. Final review found no remaining critical/important defect in this corrective scope. Browser verification was retried and remains blocked by the same protocol timeout; no authenticated customer screenshot is represented as verified.

## Split-screen preference restored — 10:51 Riga

The owner explicitly requested the previous split screen with styles in the left sidebar. Desktop CSS restores a 280px trigger/style rail and right editor; narrow screens stack. The approved email recovery and current settings/book/writer/follow-up order are retained.

Writing Assistant now has a visible Attach book or material button beside Ask/Expand. It opens the one existing private upload facility and focuses its file input; it neither uploads nor invokes a provider automatically. In the expanded assistant the canonical in-panel book library remains in the same dialog; legacy external locations fall back inline. Conversation and instruction state are preserved.

Validation:39 layout/workspace checks,73 combined assistant/release checks and10 final attachment UI tests pass; static build and diff check pass. This is a presentation correction; protected master scripts and saved email text are unchanged. Authenticated browser pixels remain outside these DOM/CSS assertions. Exact production status requires the new SHA proof.
