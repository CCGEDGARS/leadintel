# Mandatory AI rules for LeadIntel core templates

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
| Brutal Honesty | 12 | 199 | AI disclosure → sender commission → research/uncertainty → capability → proof → human invitation → meeting value → human handoff → booking → AI signature → human profile |

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

The template guarantee is restricted to deterministic wording, sequence, spacing and declared slot/omission rules. Missing or invalid source information fails closed or uses only a declared marker/fallback; it does not guarantee external factual truth or invent missing evidence. A selected default uses its saved snapshot even when its library slot was subsequently edited. The visible interface must show the default name, missing-field guidance, save status, one guarded Add to flow action, and five directly selectable approved subject choices wherever that selected core style defines five. Unsupported subject patterns stay disabled. Selecting a subject does not regenerate the body or stage an unrelated body update.

## Event invitation update audit — 10 October 2026

An explicitly applied event invitation takes precedence over the normal business default for Update message. It retains its separately approved event frame and selected event style. Use current saved details for the same event ID when present, otherwise its valid applied snapshot; never silently swap to a different event. Reject an archived, expired or incomplete event while preserving the working invitation. Refresh sender/recipient details, exact supplied booking information and the event subject, without claiming recipient attendance. Core buying triggers continue to use the protected core frame and their current source-verified/user-reviewed evidence. Personal library templates retain their own explicitly chosen pattern; a custom pattern is not automatically a protected core original.

The regular core subject choices use their five approved patterns; the event invitation uses its separately approved event subject and manual editing. Update does not authorize creating new approved event subject wording. Persistent Undo compares only the displayed subject/body, not draft metadata such as style or language, and restores the prior event snapshot as well as the exact previous text.
