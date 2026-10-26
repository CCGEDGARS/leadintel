# Mandatory AI rules for LeadIntel core templates

## Native Storyselling correction — 26 October 2026

The user explicitly corrected the separate card/bank interface. Storyselling is a normal fifth style with mandatory Email, LinkedIn and Phone call templates. Its separate new authority is `customer/storyselling-native.js`, shared by customer rendering and server catalogue; this does not alter the four canonical masters or their field permissions. Paid LinkedIn uses its own four-stage InMail sequence. The ordinary Writing Assistant retains up to three optional books and normal relevant company-material revisions. Cards and card approval are not prerequisites. Preserve legacy records and provenance. Without a source-backed case, an explicitly hypothetical explanation/two-roads scene is required; never present invented events as an actual customer outcome. Edit, Undo, Save, approval and sending retain their existing boundaries. See `storyselling-implementation.md`.

## User-approved interface consolidation — 24 October 2026

The visible AI Generated style choice is retired. Professional, NLP, Friendly and Brutal Honesty remain the email template choices. Writing Assistant owns new free-form drafts and requested working-copy edits. Preserve internal `original` modes, existing saved AI drafts, history and CRM snapshots; this UI change never rewrites or reclassifies them automatically. Legacy original-generation compatibility is not permission to reintroduce its retired style button.

Short/standard/detailed length preferences now belong to Writing Assistant's explicit email/general preview requests. They travel separately from the full 4,000-character user instruction, do not apply to advice or phone/LinkedIn formats, and never change canonical template ceilings or protected wording. Selecting a length must not generate text, invalidate approval, save a replacement draft or send anything.

Recorded 9 October 2026 as the implementation of the user's request to analyze core templates and make strict AI rules. This policy formalizes protection and existing user agreements; it does not approve new wording. Changes to the protected original require explicit user approval of the exact replacement text.

## Authority and source

`customer/approved-reference-scripts.js` contains the canonical verbatim English email originals. Its source is the user-supplied approved reference document, with the subsequently approved Professional subject correction. The records are examples of wording, never evidence about another seller or buyer. The immutable `coreContract(style)` metadata publishes each style's sequence, spacing, body ceiling and AI authority separately from that text. `customer/message-editor.js` declares the exact personalization slots and deterministic omission/fallback rules.

No AI instruction, research excerpt, generic copywriting heuristic, brand voice rule or saved example may override the approved literals. A request to improve facts, grammar of fields, relevance or personalization does not authorize rewriting the original. Suspected errors in a protected literal must be reported for approval, not silently corrected.

## Separate operations

| Operation | AI authority | Protected result |
|---|---|---|
| Core email personalization | Prepare only the six declared factual fields; deterministic code fills the pattern | Approved literals, order and first tailored original |
| Subject selection | Use the existing selected approved subject pattern and supported variables | Literal wording and punctuation of the selected pattern |
| Translation and editorial review | Natural grammar/idiom inside the corresponding source paragraph | English source, paragraph order/boundaries, signature layout, names, quantities and links |
| Explicit Rewrite | Replace the single working draft only after the user invokes Rewrite; provide Undo | Master, first tailored original and undo history; Save remains explicit |
| Manual Edit | Preserve exactly what the user types in the working copy | Master and recoverable original/history |
| AI Original | Compose freely within its separately selected length and fact/meeting rules | Core templates are unaffected |
| Personal templates/styles | Use the deliberately selected personal pattern; its example claims still require evidence | System originals and workspace isolation |
| LinkedIn | Use its own channel templates and limits | Do not compress an email original or import Brutal Honesty automatically |

The user approved a single visible working script on 9 October 2026. Explicit Rewrite may change wording and paragraph structure in that working copy, with Undo available. It is never a newly approved core template. Save, approval and sending remain separate actions. No template action authorizes sending.

## Exact sequences and lengths

The following counts are measured from the complete canonical body, including greeting, signature, booking line and optional sender-profile line, excluding the subject. A word is one nonempty whitespace-separated token. These are maximum English generated-body lengths, not targets to pad to and not permission to delete protected text.

| Style | Original blocks | Maximum body words | Distinctive protected progression |
|---|---:|---:|---|
| Professional | 12 | 185 | Observation → role question → sender → capability → focus → proof → invitation → goal → meeting comparison → booking → signature |
| NLP (`curiosity`) | 13 | 219 | Development → sender → partnership → capability/outcome → keep-what-works comparison → proof → proposal → decision value → final invitation → booking → signature → profile |
| Friendly | 11 | 200 | Milestone → sender → experience → acknowledgment/conditional benefit → proof → coffee/invitation → meeting material → booking → referral → signature |
| Brutal Honesty | 12 | 179 | AI disclosure → sender commission → research/uncertainty → capability → proof → human invitation → meeting value → human handoff → booking → AI signature → human profile |

Every sequence begins with the greeting. Retained blocks stay in their original relative order. The exact block-by-block order is published by `coreContract(style).paragraphRoles`; the table is explanatory, not a replacement pattern. Do not impose the Professional ending on another style. NLP keeps its partnership and keep-what-works wording; Friendly keeps its acknowledgment that the buyer may already be covered; Brutal Honesty keeps transparent AI disclosure and the human handoff.

Only explicitly coded unsupported-fact omissions and fallback invitations may reduce the block count. Missing facts do not grant freedom to reorder, merge or invent blocks. Never trim the assembled body arbitrarily to pass a word limit. If supplied slots exceed the budget, shorten eligible fields faithfully or reject preparation and preserve the working draft.

Translations use native grammar and preserve the source structure and meaning. The English word ceilings are not an automatic truncation rule for another language. Manual copies retain exact user text and are not silently shortened to generated-copy limits. AI Original currently has separate short/standard/detailed targets of 80–120, 120–200 and 200–300 words; these controls do not apply to core templates.

## Wording and substitutions

1. Copy all literals outside the declared slots exactly: words, punctuation, capitalization and sentence order. No synonyms, transitions, added persuasion, new benefit sentences, repeated lists or automatic grammar fixes to protected literals.
2. Replace recipient/sender names, seller company and approved URLs deterministically from the active workspace. Do not ask AI to invent or improve names, titles, a surname, company identity or links. Preserve supplied spelling and diacritics.
3. The AI field response must contain exactly six string keys: `triggerSummary`, `offer`, `value`, `difference`, `approach`, `meetingValue`. Extra keys, a subject, a whole message, arrays, nulls, missing keys or instructions are invalid. Some fields are intentionally unused by a particular style; receiving them does not authorize inserting them elsewhere. Professional fixes `value`, `approach` and `meetingValue` to empty field outputs because its corresponding approved statements remain literals.
4. Each field uses only its own supplied source. Empty source means empty output. Preserve already-valid English source fields exactly; translating another field does not authorize paraphrasing them. Preserve quantity meaning when translating supported foreign evidence. No new numbers, dates, experience, clients, urgency, authority, savings or guarantees.
5. Grammatical slot shapes are mandatory. `triggerSummary` is an event noun phrase for Professional/Brutal Honesty and factual sentence for NLP/Friendly. `offer` is a noun phrase after provide. `value` is an infinitive phrase after could, without company subject or modal verb. `difference` is one supplied experience sentence. `approach` is one factual sentence. `meetingValue` is a noun phrase describing supplied material, not another invitation. Do not duplicate a source capability list across slots.
6. Use the pattern's declared slots only. Do not create a new slot by treating protected prose as a variable. The Professional profession-specific production/project terms, selected meeting platform, and existing style-specific sentence/voice adjustments are explicit code transformations; they do not authorize free rewriting.

| AI field | Maximum characters | General maximum words |
|---|---:|---:|
| triggerSummary | 240 | 14 |
| offer | 180 | 12 |
| value | 160 | 12 |
| difference | 220 | 20 |
| approach | 180 | 12 |
| meetingValue | 180 | 12 |

The actual request's `wordLimits` may be lower. Professional distributes its remaining budget across eligible factual fields while retaining valid fields. All four assembled bodies must pass the original-body ceiling. Do not shorten an approved valid field merely to make room for unrelated profile prose.

## Spacing and presentation

- Separate retained email blocks with exactly one blank line (`\n\n`). Preserve the single line break inside the approved signature. The sender LinkedIn profile is a separate block where the style includes it.
- Generated working bodies have no leading/trailing empty blocks, duplicated blank lines, indented paragraphs, headings, bullets, emojis or markdown emphasis added by AI. Existing canonical trailing spaces remain in the source; the deterministic working renderer trims block-edge spaces. This is formatting normalization, not a change to wording.
- The subject is separate from the body: one clean line, no `Subject:` prefix, URL, commentary or research paragraph, at most 60 characters. Existing approved patterns are authoritative; the generic 3–8-word preference cannot rewrite them. Five working choices per core style are already defined in `message-studio.js`; Brutal Honesty's canonical source lists one example subject, which must not be silently expanded in the master.
- Translation retains each source paragraph and signature line break. It keeps names, numbers, links and placeholders in their corresponding paragraph. It cannot merge, split or add paragraphs. Editorial review follows the same rules.

## Facts, omissions and meeting consistency

Buyer/project insertions require the selected `user_reviewed` or `source_verified` trigger and its source URL. Seller facts require the active workspace's supplied/approved context. An example customer, a research headline or template sentence does not establish buyer need, purchasing authority, similarity, a success story or a measurable result. Known facts and commercial hypotheses remain distinct.

Only the current deterministic omissions/fallbacks are allowed: unsupported event/role opening blocks are removed; missing project detail uses the declared generic invitation; unsupported evidence links and optional meeting-material/profile blocks use the existing style rules. Professional retains its approved `[link]` marker until the reference is supplied. A draft may show missing-data markers for review; approval must reject unresolved sender, booking and reference markers. Never substitute an example-customer URL or claim a reference exists merely because a website exists.

The core conversation is 20 minutes. The selected Zoom, Microsoft Teams or Google Meet platform may fill the working invitation without changing the master. Use the supplied validated booking URL exactly. Do not invent a conferencing URL, add a second booking action or convert a company fit score into a purchase probability. No-slides wording requires the existing supplied meeting commitment. Missing information preserves the draft and explains what needs completion.

## Persistence, validation and limitations

Master wording and the first tailored original are immutable. Manual edits, explicit rewrites and translated copies are separate working versions. Preserve original history and the selected trigger/source association through CRM save/reopen, synchronization and serialization. Source/workspace/buyer/style changes invalidate prepared-field fingerprints; a late AI response must not overwrite a manual edit or another context. Rendering, selecting a style or reloading must not silently replace an existing draft.

Deterministic checks enforce source assembly, fields/schema, numeric additions, approved links, body ceilings, translation layout and protected tokens in corresponding paragraphs. Prompts state the semantic rules. These checks do not prove that an arbitrary paraphrase has identical meaning or that every plain-text claim is true. Human review remains necessary; report that limitation instead of calling a numeric/layout check a semantic guarantee.

For future changes, regression checks must cover exact master preservation for all four styles, each sequence/ceiling, extra/missing AI keys, unsupported facts, layout/token movement, different industries and seller names, original/history preservation through CRM reload, and late-response/context rejection. Release claims require the repository's exact-SHA release-integrity proof.

## Explicit Update message — 10 October 2026

The user approved Update message as a restoration/compliance action. For email it selects the saved default snapshot when configured; otherwise it uses the currently selected approved or personal template. It deterministically rebuilds the working body from that authoritative pattern and current reviewed facts. A prepared whole-message proposal is not authority for template compliance. This action never rewrites protected core literals, independently researches facts, saves, approves, sends, or starts a flow. Deliberately typed subjects are preserved when restoring the same selected template; supported approved choices are refreshed separately. AI Generated without a saved default remains a separate Generate action.

On first creation, controlled personalization and subject choices are prepared automatically after recipient, Profile and evidence gates pass. Later automatic preparation preserves saved/manual/approved working copies and proposes an update. Explicit Update message may replace manual wording, with the exact previous draft retained through persistent Undo and CRM serialization. Even identical restored text requires explicit Save. Reset still restores the first tailored original; Update message rebuilds from the current authoritative template and facts.

The template guarantee is restricted to deterministic wording, sequence, spacing and declared slot/omission rules. Missing or invalid source information fails closed or uses only a declared marker/fallback; it does not guarantee external factual truth or invent missing evidence. A selected default uses its saved snapshot even when its library slot was subsequently edited. The visible interface must show the default name, missing-field guidance, save status, one guarded Add to flow action, and five selectable approved subject choices wherever that selected core style defines five. The selected subject remains visible; the alternatives may be collapsed under Choose subject to save space. Unsupported subject patterns stay disabled. Selecting a subject does not regenerate the body or stage an unrelated body update.

## Explicit writing-style selection — 10 October 2026

The user requires choosing a different email writing style to apply that style's authoritative body and subject, rather than leaving the previous style visible. A deliberate core or saved-template selection is an explicit controlled update: clear the previous default selection, rebuild from the selected pattern and confirmed facts, retain exact replaced text through persistent Undo and CRM serialization, invalidate approval, and require Save again. A background refresh or page reopen still preserves saved, manual, approved and translated copies and proposes changes separately. English style selection refreshes the English working copy while retaining other language versions; those versions become stale against the new source. AI Original remains an explicit Generate action and event invitations retain their separate event frame. Missing facts, blocked recipients or failed field preparation preserve the displayed text and explain why the selected style could not be applied. Late preparation for another style, workspace, recipient or changed draft must be rejected. No template literals, Save rules or send permissions change.

## Event invitation update audit — 10 October 2026

An explicitly applied event invitation takes precedence over the normal business default for Update message. It retains its separately approved event frame and selected event style. Use current saved details for the same event ID when present, otherwise its valid applied snapshot; never silently swap to a different event. Reject an archived, expired or incomplete event while preserving the working invitation. Refresh sender/recipient details, exact supplied booking information and the event subject, without claiming recipient attendance. Core buying triggers continue to use the protected core frame and their current source-verified/user-reviewed evidence. Personal library templates retain their own explicitly chosen pattern; a custom pattern is not automatically a protected core original.

The regular core subject choices use their five approved patterns; the event invitation uses its separately approved event subject and manual editing. Update does not authorize creating new approved event subject wording. Persistent Undo compares only the displayed subject/body, not draft metadata such as style or language, and restores the prior event snapshot as well as the exact previous text.

## Mandatory subject preparation — 10 October 2026

The user confirmed that the system must find specific supported details for the five Professional subject patterns and retain their literal wording within a maximum of 60 Unicode characters. The five approved originals remain unchanged. The active workspace's confirmed seller fields and extracted official seller pages now supply material, installation and technical relevance; an example script or the word metal alone does not establish steel capability. Profile scraped sources and evidence excerpts reach the message context. Source URLs must match the current seller website; unrelated websites, snippets without extraction, failed sources, unsafe text and negated statements cannot establish a capability.

An execution-class question requires relevant seller EN 1090/EXC evidence or explicit execution-class evidence in the reviewed project trigger. EXC2 or EXC3 is an open question, not a claim that the seller holds EXC3 certification or that the buyer needs that class. A class explicitly recorded in the current reviewed trigger takes precedence over the example alternatives. Never infer buyer requirements from seller certification. Subjects use complete supported project/location aliases that fit the remaining character budget; do not cut proper names, invent abbreviations, change approved literals or remove punctuation to fit.

Messages opening and explicit Update message first inspect current confirmed facts and stored evidence. Where gaps remain, workspace-authenticated Firecrawl search/extraction performs at most three targeted searches and two official-page extractions per search under a 45-second cancellation window. Source evidence and results persist on the CRM-synchronized message item. The same unsuccessful context is not searched repeatedly on page reopen; Find missing details or explicit Update message retries it. Changed workspace, seller, recipient, trigger, style or source inputs reject stale results. Research never grants approval, starts a flow or sends.

Page quality checks all five choices, selected-subject validity/60-character length, and current support for automatically prepared subjects. Five-choice completeness is distinct from permission to use a valid deliberately reviewed working message: an incomplete set reports Needs review, with the exact missing data, even when a saved selected subject is usable. Missing alternate facts do not authorize invention or silently redefine the master. Saved/manual/approved/translated working text remains protected; changed evidence proposes an update instead of overwriting it.

These checks prove structural compliance and evidence association, not unrestricted semantic truth or current validity of a historical certificate. A public project describing EXC2 manufacture supports that project experience; it is not proof of a current EXC3 certificate.

## Evidence preparation recovery — 10 October 2026

Research uses independent, concise queries derived from the active seller's offer instead of requiring every service and standard in one search result. Failed or empty research remains incomplete and exposes the provider error or missing evidence. Changed official Profile evidence invalidates the previous attempt; page reopen does not repeatedly spend credits on an unchanged unsuccessful context.

The declared reference-link slot may use an extracted official project, case-study, reference, portfolio or gallery page describing actual delivery, manufacture, installation or completed work. An explicitly supplied proof URL takes precedence. A homepage, third-party result, unreadable snippet, negated statement or unsafe source cannot establish a project reference. This fills an existing slot only; it adds no wording or claims and changes no approved master. Automatic preparation proposes updates to saved/manual drafts; explicit Update message and Save retain their existing authority and persistent Undo behavior. Message page checks must remain visible outside hidden journey guidance.

## Mandatory message research and comparison fallback — 10 October 2026

The user approved proactive research for the fields used by every approved subject and script, and explicitly broadened the fifth Professional subject from a technical question into a relevant either/or comparison. This section supersedes a technical-only reading of the earlier subject-preparation rule. The canonical example subjects and script masters remain verbatim; the working fifth pattern remains `[verified context]: [comparison]?` within 60 Unicode characters.

`customer/message-evidence.js` is the shared field contract. Profile research discovers service, delivery, experience, reference and technical pages on the active seller domain. Bounded website reading reserves coverage for references and technical specifics rather than spending the entire page budget on product links. Company/trigger evidence retains its source text, and reviewed-project follow-up searches for schedule and specifications separately. Message preparation reuses those facts and performs bounded searches only for unresolved seller gaps. A known project reference or certification does not resolve a missing material. Optional technical detail is distinct from essential sender, offer, experience, reference, recipient and booking facts.

Record each fact's owner, value, source URL or user declaration, excerpt, verification and available extraction date. Keep supplied sender identity, booking URL, meeting commitments and optional proposed dates separate from public research. Research findings remain source facts; they do not automatically become user-confirmed Profile answers, buying requirements, approved wording or permission to send. The checklist and bounded excerpts persist with the CRM-synchronized script research checkpoint. Existing source records remain authoritative; no provider secrets or full duplicate page corpus enters the checkpoint.

The fifth subject must remain complete. Prefer two supported technical alternatives or concise supplied service alternatives; an explicitly supplied pair of valid future meeting dates may take precedence. A generic timing question such as `compare now or later` supplies a complete fallback without claiming a buyer deadline or purchasing need. EN 1090 alone, or a single EXC class, never invents a second class. Use a supported project/location alias, otherwise the confirmed target company, otherwise a neutral context. Do not cut proper names or create abbreviations to fit. Dates come from two explicit sender settings, are checked for validity and expiry, and name their month in the working English subject. No calendar-availability integration is implied. Expiry changes newly prepared choices and update proposals; it never silently overwrites a saved/manual draft. Unsupported technical detail stays a research gap even when the timing comparison is usable.

The other four Professional patterns retain their existing evidence requirements, and all styles retain their wording, slot permissions, ordering, spacing, body ceilings, review and Save requirements. Missing alternatives do not authorize changes to body literals. Five-subject readiness and essential message-fact completeness are separate visible checks; neither replaces exact-message approval or the existing sending guards.


## Explicit subject category variations — 11 October 2026

The user authorized separate Reset subjects, Edit subjects, Update selected/Update all five and Save subject controls, requiring every working variation to retain its original category and core requirements. `customer/subject-editor.js` governs these explicit working alternatives. Protected source patterns and the approved-reference master remain unchanged. Automatic personalization still uses the approved originals; it does not gain free subject rewriting authority.

Each core style retains its own five category IDs. A working AI request receives only complete, supported, at-most-60-character category candidates derived from the current approved pattern's exact fact slots. AI may select a fresh candidate within that ID; deterministic parsing rejects a changed category, extra body, missing/duplicate IDs, unsupported text, repeated working text or invented facts. Project, offer, material, identity, score and the entire two-option comparison remain intact. The comparison retains the existing supported technical/services, supplied future meeting dates, or explicit now/later timing logic. Unknown facts stay unavailable; the button does not perform independent research or invent completeness. A missing category disables Update all five and explains the missing facts. Localized candidates preserve translated wording and fact slots; no English copy is inserted into another language.

Manual subject edits must remain complete, keep category fact anchors and intent, and pass line/length/numeric/identity checks. Deliberate manual wording still requires human factual review; these checks cannot prove unrestricted semantic truth. Reset restores the current style's original patterns with current supported details, preserving the message body. Subject Undo and the working set persist in generic CRM script metadata alongside protected original/history records. Save subject uses the existing explicit CRM script-package save and saves the selected subject with the body exactly as displayed. Adding to templates or a flow requires that exact saved message and grants no permission to send or activate.

Any workspace, recipient, channel, style, identity, evidence, language or working-draft change rejects a late subject response. AI failure or timeout preserves the prior subjects and body. Working variations are tied to their source fingerprint; stale sets cannot be reused for another context. Style updates show a visible updating highlight beside subject/body, and success is indicated only after the actual new style is applied.

## Adjust message panel correction — 11 October 2026

The user clarified that the original editor and left-side assistance panel must be restored. The panel is titled Adjust message and has two visible body actions: Shorten and Create variation. Shorten removes repetition from the currently displayed working body; Create variation requests a meaningfully different opening, wording and paragraph flow using supported selected content and current facts. Repeated requests avoid earlier variants. There is no three-preset length editor. Update message remains in its original editor action row and retains deterministic template restoration and current factual-field preparation.

Both explicit body adjustments preserve the selected subject, protected master and first tailored original. Existing link, sender, meeting duration, core ceiling, event and disclosure validation remains enforced. Failure, timeout, unchanged shortening, repeated variations and stale context preserve the draft and release the controls. The exact prior draft is retained through persistent Undo and CRM serialization. Save remains explicit; neither action approves, sends or starts a flow. Semantic fidelity still requires human review.

## Core renderer recovery — 11 October 2026

The user explicitly requested repair of the recurring non-approved Friendly body and missing fifth subject. The canonical records remain unchanged. The working renderer now narrows existing experience slots: when current seller facts establish the duration, steel, drawings, manufacturing, installation and qualified workforce, Friendly/NLP/Brutal retain the approved experience voice with the supplied duration and company. Raw source fragments establish these facts; an AI-prepared Profile sentence cannot replace the supported frame. Other industries retain the existing supplied experience/capability fallback without importing example metalworking claims. Negated or unconfirmed statements cannot establish these fragments.

Friendly retains its approved extra-pair-of-hands conditional wording around the existing offer/value slots and its steelwork referral when steel is supported. Its positive opening retains Congratulations on around the supported event; unsupported example foundation, scale, geography and 2028 assertions stay omitted. Brutal retains its approved outcome/website sequence and a supported steel-partner term; its development remains an event noun phrase. Existing evidence-dependent meeting wording and omission permissions remain in force.

The normalized reviewed trigger derives positive milestone status from its validated event excerpt, never from an arbitrary caller flag. Cancelled, delayed, negated and hypothetical events cannot enable congratulations. All five subject categories and their factual requirements remain unchanged. Before a core update is applied or proposed, the completed body must match deterministic current-source assembly, obey its style ceiling, and have all five complete subjects. Failure preserves the current working copy and original/history, releases Updating, and displays the missing facts. This gate does not constrain deliberately edited, shortened, rewritten, translated or personal copies to core wording.

Renderer version 7 invalidates older prepared fields and automatic source fingerprints. Existing saved/manual copies are proposed for update; explicit Update retains persistent Undo and requires Save again. Golden emitted-body tests complement immutable-master tests, including real dossier normalization and mounted save/reopen coverage. These deterministic checks do not prove unrestricted semantic truth of supplied prose.

For a restored supported experience frame, factual preparation measures each remaining slot’s occurrences against the complete style ceiling. A repeated benefit consumes its full word cost. An otherwise concise source that exceeds this actual remaining field budget may be shortened faithfully within that declared slot; fields that fit retain their supplied English exactly. The protected frame is never trimmed to make room.


## Explicit message creation and controls — 11 October 2026

The user approved empty new drafts and deliberate message creation. Opening a new recipient selects/researches evidence but leaves subject/body empty until a style is clicked or Update message is pressed. Reopening keeps saved/working text exactly; background preparation may propose an update but never replaces an existing body. Every core style click, including the already selected style, rebuilds its protected canonical reference with current supported facts. A saved personal revision remains stored but its active override is turned off by a deliberate core style click. AI Generated creates a fresh original on each click. Explicit style selection can leave the separate event frame; ordinary Update of an applied event retains its existing event authority.

Update message restores the currently selected template with current facts, rather than silently applying a different automatic default. An explicitly applied default retains its captured saved pattern. Reset retains the first personalized original. Save remains explicit and exact; templates, defaults, flow and send gates remain unchanged. A green Update message button sits beside Add to flow, with the helper “Choose the style and update your message.” Lower actions are Edit, Save, Reset, Add to templates and Set as default. Undo is hidden; internal recovery history remains durable.

Missing facts, failed field/AI preparation and stale responses preserve the previous working message. AI results check request ownership, current workspace/recipient/channel, facts, editor text and sync readiness before application. A sync conflict receives one plain notice and Resolve action; it cannot be overwritten by an update-available hint and neither version is automatically chosen. Existing protected wording, slot permissions, body ceilings and subject rules remain unchanged.


## Blank editor during deliberate preparation — 11 October 2026

The user clarified that style selection must not keep the previous email visible while the new style prepares. An explicit reference-style or AI Generated click, or explicit Update, shows empty read-only subject/body fields until validation completes. The prior draft, canonical DOM fields and persistent records stay intact; the blank loading view has no persistence authority. Success displays the validated selected-style result and requires Save. Failure restores the prior visible draft and explains the failed preparation. Rapid switching retains the newer request's blank view and rejects old replies. Saved reopening, background update proposals, subject-only updates, translations and flow actions do not use the blank preparation view. This clarification changes presentation only; approved template literals, facts, original snapshots, review and send guards remain governed by the existing policy.

## Approved Brutal Honesty revision — 13 October 2026

The owner approved all three exact corrections recorded in `docs/fixes/2026-10-13-generation-payload.md`: “My research led me”, commissioning research for the seller company without asserting employment, and using the benefit once rather than in three places. The capability paragraph omits the duplicated outcome sentence; the meeting paragraph closes with “You can share your requirements and assess whether {{company}} is the right partner.” This is the protected Brutal Honesty master from this approval onward, with 12 blocks and a measured ceiling of 179 words. Other masters retain their previous wording and ceilings. The original October 9 test fixture remains historical; the October 13 fixture records this approved master. Existing saved working drafts and their histories are preserved; Update message applies the current template explicitly.

## Writing Assistant workspace — 15 October 2026

The owner approved loading editable copies of every available style and saved template into the Writing Assistant, plus pasted scripts. These copies are explicit working alternatives: Shorten, Strengthen persuasion and Personalize may revise them. They do not redefine protected masters or first tailored originals and do not inherit the original English style ceiling. Final generated subjects remain one line and at most 60 characters; pattern inputs may be longer while being edited. Apply changes only the assistant working copy; Undo and Restore original remain available. Save as template opens reusable-template review. Use in current flow saves the reviewed draft into Step 6 without approving, enqueueing or sending. Existing delivery readiness and approval gates still apply.

The Content Library holds three private books/files, with at most one active Ready source. Covers and user-written display descriptions are presentation only, never factual evidence. Source guidance informs explicit proposals and AI Original; it cannot silently rewrite a draft or override governing identity, facts, links, event requirements or disclosure rules.

## Channel library and platform authorship — 15 October 2026

The owner approved Email, LinkedIn and Phone call with four predefined style slots plus AI Generated and a shared Script Assistant. Core masters can only be added, edited or deleted by the platform owner; customer workspace ownership does not grant this authority. Existing approved literals remain unchanged unless the owner explicitly saves a reviewed replacement. The channel registry retains revisions and deletion tombstones. New/edited patterns permit only explicit {{field}} substitution; missing information remains a visible marker and blocks final saving until resolved. AI cannot change a master. Missing phone and LinkedIn Brutal Honesty masters must remain unapproved empty slots until the owner supplies them.

A customer may create a personal copy and choose it as their primary for a channel. The personal preference governs new empty manual drafts, while existing scripts, other channels, other users and already-configured flows remain preserved. Returning to a core script is explicit. Phone preparation uses the selected customer and reviewed research; Save records a script, never a completed call or delivery. Make a call is a labelled coming-soon dialog until a separately approved calling integration exists.

## Owner-supplied LinkedIn InMail sequences — 15 October 2026

The owner supplied PROFESSIONAL_LINKEDIN.docx, NLP_LINKEDIN.docx, FRIENDLY_LINKEDIN.docx and BRUTAL_HONESTY_LINKEDIN.docx, then selected a separate InMail mode while retaining standard direct messages. `customer/approved-linkedin-inmail.js` preserves the full extracted paragraph text and source-file SHA256 for each original. Four ordered steps are distinct: initial InMail with subject, conditional no-reply connection request, after-acceptance follow-up, and calendar reply after interest. Source annotations and counts are reference metadata, not recipient text. The original documents stay unchanged.

InMail patterns replace only explicit example-specific factual slots. Existing literal tone, progression, invitation and authorship wording stay protected. Current seller/recipient identity and reviewed development may prefill existing supported values. Missing experience, project dates, routes, quality/cost/reliability claims and references remain unresolved fields; example ERCON/Malmberget facts never establish another customer's facts. Unsupported fields block copying. Applying facts rebuilds working copies explicitly; manual edits and assistant proposals remain alternatives, never masters. The raw originals and prior approved revisions remain viewable separately.

Read-profile, fact-review and read-every-word confirmations precede copying. AI-work and sole-human-authorship claims require separate confirmation where those claims appear. The connection request requires an actual initial-send date, no-reply and timing/wording confirmation; acceptance and interest are separately confirmed before their replies. These are manual drafting controls, not independent verification of arbitrary factual prose or LinkedIn events. Copying never records a send, advances CRM, schedules work or starts automation.

Only the platform owner may edit/delete/reinstate InMail core sequences. Existing master history, deletion tombstones, optimistic concurrency and account isolation apply. InMail personal templates and their primary preference are separate from direct-message templates and primary. Contact drafts are server-backed, quota-accounted and do not replace email/DM/phone drafts. Save may preserve an incomplete draft for later work; Copy remains gated. Script Assistant and AI Generated use an InMail stage context: only the initial stage has a subject, and the booking URL stays in the interest reply. Standard direct-message rules remain unchanged.

## October 15 email masters and corrected import — 16 October 2026

The owner requested correction and use of the four email DOCX originals supplied
on October 15. These originals supersede the October 9/13 wording and the old
paragraph-count/word-ceiling table above. The canonical source remains
`approved-reference-scripts.js`; the independent `approved-core-masters-2026-10-15.json`
fixture records the source paragraphs and internal line breaks. Brutal includes
its greeting. Professional's reliability/quality/cost lines and every source
signature retain their line breaks. Contract `email-master-20261015-v2` measures
its paragraph and body-word limits directly from each corrected source.

The same declared source-span map now governs the reusable pattern and native
renderer. Identity, source-backed development paragraphs, seller description and
experience, services/work packages, project/contracting route, proof, service
priorities, meeting material, referral focus and supplied links are factual
slots. They carry current workspace information only. The fixed prose outside
these spans stays exactly as approved. Source examples do not establish country,
market, experience, project phase/year, contractor or certification. Unknown
Professional project/reliability/quality/cost facts remain visible markers;
unknown references retain [link] in Professional or are omitted as complete blocks
in other styles. Unsupported contracting routes, missing development paragraphs,
absent optional profile links and unconfirmed No slides are omitted. The example
project's two-year horizon has only the nonnumeric “your project” fallback.

All four master versions enter factual fingerprints and source scopes. Explicit
Update/style selection may restore the new pattern with persistent prior-text
recovery; reopening never silently replaces a saved/manual draft. Backend seeds
are generated from the same source, and known obsolete builtins migrate with
history while owner edits and tombstones remain intact. Missing markers block
final actions; template generation never supplies approval or send authority.
The source's “20 minutes on Zoom” and “20-minute chat on Zoom” are valid invitation
forms and retain the selected working meeting platform. The fuller root cause,
source boundaries and verification are in `docs/fixes/2026-10-16-email-master-integration.md`.

## Approved source voice correction — 16 October 2026

The October 15 masters remain verbatim. Declared factual spans retain their source sentence frames when the workspace supplies their facts. A generic “a company providing” Profile summary must not replace the approved company description; a verified sorting plant must not become an unspecified project. Source-aware company, experience, work-package, project, milestone and route frames require explicit supporting seller/selected-trigger evidence. Geography, years, Arctic location, contractor and schedule remain unknown unless supported. Other industries derive their description from their own offer. No ERCON, LKAB or Malmberget identity is a runtime default.

Renderer contract `email-master-20261015-v3` invalidates prepared caches. Explicit Update preserves prior text in recovery history and leaves a visible completion receipt; Save remains separate. Source originals, layout/length gates, six-field AI authority and approval/send controls remain unchanged.

## Fixed factual frames — 16 October 2026, screenshot regression

The owner reported the working NLP email still differed from the October 15 original. The earlier v3 rule retained source frames only when every fact happened to be available; otherwise it silently substituted a generic AI event sentence. This exception was incompatible with protected core wording.

Contract `email-master-20261015-v4` removes whole-paragraph development/friendly-opening/experience slots from native core patterns. The source opening and Friendly experience structure are retained, with deterministic factual atoms for project, type, milestone, opening year, deliverable and supported experience. Unknown atoms use `[Add verified …]` review markers within the source frame. They block approval/flow through the existing unresolved-fact gate. Unreviewed openings and unsupported Friendly congratulations/scale clauses retain their existing explicit omission rules. AI summaries cannot replace these core paragraphs. An invalid pattern containing the old paragraph slots fails closed at runtime.

Official seller descriptions, proof and meeting material still carry the current workspace’s supported facts; differences from example facts are not permission to invent the example’s claims. Originals, manual alternatives, personal templates and deliberately selected AI Generated remain separate authorities. Existing drafts and history remain preserved until explicit Update. Backend builtin migration retains replaced patterns and respects owner edits/tombstones. A mandatory production smoke requires the runtime paragraph-slot guard. Tests cover the actual missing-facts screenshot case, all-supported exact source paragraphs, invalid/negated facts, other industries, cache invalidation, blocked flow and save/reopen.

## Professional replacement — 17 October 2026

The owner-pasted replacement supersedes only Professional. Exact source: `approved-reference-scripts.js` and effective fixture `approved-core-masters-2026-10-17.json`. The October 15 fixture remains historical. The other three styles and all five Professional subject choices are unchanged.

Professional sequence: greeting; introduction and reference URL; bid request; Sure acknowledgment; Reliable/Quality/Safety/Cost rows; contribution statement; separate 20-minute call question; booking block; compact sender. company signature and sender LinkedIn line; referral P.S. Identity, company description, offer, project target, reference, booking, profile and proof values are declared slots. Specialization is no longer appended to the Professional introduction. Existing meeting-platform selection remains supported. Retained blocks keep their approved order.

The master is an example, never evidence for a different seller. Delete Reliable without real affirmative proof. Omit Quality and Safety unless current seller facts establish them. Planned, negated and third-party certifications are not valid proof. EN 1090-1, EXC2/EXC3 and ISO 45001:2018 cannot be inherited from the example. Show class/edition only when supplied. Cost uses concrete supplied cost basis or the visible delivery-blocking marker [Add verified cost basis]. Missing reference/profile URLs are omitted, never borrowed. Use the active user's configured booking URL in its separate block. Use your new <project> <kind> only when supported, otherwise the declared generic your project fallback.

Only Professional becomes email-master-20261017-professional-v1; field caches and original scope invalidate accordingly. Backend seeds retain builtin migration history. Owner custom edits, deletion tombstones, personal templates, saved/manual drafts and historical originals are preserved. Explicit Professional selection applies the replacement with recoverable previous text.

## All-style factual preparation — 22 October 2026

The owner approved applying the shared factual-preparation rule across Professional, NLP/Curiosity, Friendly, Brutal Honesty, AI Generated and personal email styles. Prepare a recipient-owned fact report from the active workspace Profile, reviewed buyer context and extracted official evidence. Rank relevant supported project/milestone/schedule evidence above generic news. Plan bounded official buyer and seller research even when a selected appointment has no recognized project, and derive searches from mandatory body gaps as well as subject gaps. Reuse query receipts and evidence across styles for the same workspace, buyer, recipient and Profile facts; explicit retry may repeat research. Store actual provider executions, failures, excerpts and source URLs, not a claim that configured tools ran.

When required project-opening atoms cannot be verified, apply the existing no-event omission to that opening as a unit. This is the owner-approved fallback for this rule; it does not permit new prose, guessed dates, invented milestones or changes to the canonical masters. Retain the raw reviewed event and evidence for research and supported subject choices. Other mandatory missing facts retain visible markers and Needs information status. Saving an incomplete working draft does not make it ready for delivery.

Show Preparing while fact research runs. Complete an explicit style action only if the exact working draft, style, workspace and recipient still belong to that action. Preserve its original Undo boundary across factual completion. Saved, manual, approved, translated and rewritten drafts remain protected from implicit replacement. AI Generated waits for the bounded factual preflight before composing. An old or contradictory schedule uses the declared omission; preparation outcome participates in the scope so expired dates cannot silently remain in an untouched automatic draft. Save, approval and sending remain separate actions.

## Shared research brief and factual opening variation — 22 October 2026

The owner explicitly approved the shared Buyers → Messages brief and its bounded source-backed opening variation. `docs/policies/shared-research-brief.md` governs this rule. When project milestone/year atoms are unavailable, a supported affirmative development sentence may fill the same NLP/Friendly/Brutal Honesty opening position as `I noticed <verified statement>.` (or `I noticed that <source statement>.`). The deterministic leading Our/We adjustment is permitted. This supersedes the earlier whole-opening omission only when a usable sourced fact exists. No unsupported milestone, year, congratulations or commercial need is permitted. Otherwise omission remains required. Existing core literal blocks, order, ceilings and six-field AI preparation authority stay protected; canonical master text is unchanged.

## Outcome-first Writing Assistant — 25 October 2026

The owner approved replacing the visible Shorten, Strengthen persuasion, Personalize, Draft length and separate Ask assistant controls with one outcome instruction, three optional books and one preview request. The unified request accepts questions as advice or explicit writing changes as a proposed working copy. It sends no hidden length preference; the user may specify length in the instruction. Historical length preferences and preview/advice API compatibility remain intact. This supersedes only the October 24 visible length-control placement, not template authority or canonical limits.

Apply changes accepts a proposal only into the assistant working copy. Save draft persists the exact customer draft in Messages/CRM, or independent general writing in its separate library. Save as template uses the existing personal-template workflow. A pending preview must be applied or discarded before saving. Book activation alone changes no text. Protected masters, evidence checks, sender/recipient identity, links, formatting, provenance, Undo and save/approve/send boundaries remain governed by the earlier rules.
