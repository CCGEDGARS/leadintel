# LeadIntel Campaign Studio Design

## Decision

Step 6 is **Campaign Studio**. It extends the existing evidence-backed outreach workflow without adding another onboarding step or a programmable playbook system.

## Workspace default

Every workspace has one mandatory Core Outreach Scenario generated from the approved Company Intelligence Profile. It contains the default target segment, offer, buyer role, buying trigger, value proposition, commercial objective, call to action, tone and language.

The user may accept, edit, replace or regenerate the scenario. It cannot be saved with an empty summary. A material Company Intelligence Profile change marks an approved scenario `needs_review`; it does not silently rewrite the user's approved text.

The scenario is stored inside the existing server-synchronized customer workspace state. No additional local-only source of truth is introduced.

## Segment presets

A user creates a segment preset by entering one required value: the target segment. The preset inherits the remaining fields from the Core Outreach Scenario. Tone may be changed. Presets are reusable and workspace-scoped.

## Interface and email languages

The workspace/interface language and the campaign email language are independent. A workspace may keep Latvian as its default language while Campaign Studio uses `Auto · recipient local language` or an explicit campaign language.

Automatic language selection uses the verified opportunity market first and a country-code domain only as a secondary signal. Ambiguous or unsupported locations fall back to English and block approval until the user confirms the language.

English and Latvian use LeadIntel's native templates. Other supported European languages are rewritten through the workspace's single active AI provider. This is native B2B localization rather than literal translation: local formality, greetings and calls to action may adapt, but facts, numbers, names, URLs and placeholders must remain unchanged. Invalid or incomplete AI output is rejected and the campaign cannot be approved.

The final approval freezes the selected language mode, resolved language, selection source, AI provider and model alongside the campaign and message snapshots.

## Existing workflow integration

The active core scenario or segment preset feeds the current opportunity dossier and script generator. Existing outputs remain:

- cold email;
- LinkedIn message;
- call opener;
- follow-up email;
- objection/reply response.

Generated text remains editable. Regeneration invalidates prior approval. Approval freezes both the message source and an immutable campaign-scenario snapshot before Delivery & Learning can send it.

## Safety and migration

- Existing outreach records without campaign context remain readable and sendable under their existing approval rules.
- Automatic delivery rules, suppression, reply-stop behavior and mailbox limits remain unchanged.
- The Core Outreach Scenario is a fallback; segment presets never replace company evidence.
- A scenario or preset cannot create evidence or override the dossier's evidence ledger.

## State shape

`main.campaignStudio` stores:

- `schemaVersion`;
- `coreScenario`;
- `presets`;
- `selectedPresetId`.

Each outreach item may store:

- `campaignScenario` for the active editable context;
- `campaignSnapshot` after approval;
- localization status and provider provenance;
- `localizationSnapshot` after approval.
