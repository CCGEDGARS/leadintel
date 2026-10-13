# Step 6 generation failure and applied-style state

## Reproduced defect
AI Generated serialized complete scraped records and repeated evidence collections into its prompt. The backend rejects prompts longer than 80,000 characters. The new regression reproduces this rejection with large research records, then verifies the request is below that boundary while stored research remains byte-for-byte unchanged.

## Change
Generation receives deduplicated, bounded excerpts with source metadata. Selected identity and trigger fields precede supplementary research. Raw HTML and binary representations are excluded. A failed style change retains the previous draft; the checkmark identifies its applied style while the selection highlight identifies the next requested style. AI Generated instructions prohibit repetitive benefit clauses and unsupported identity inference and require consistent terminology with the selected trigger. Parent module and stylesheet versions are refreshed. Release checks inspect both changes.

## Protected copy requiring exact approval
The core-template policy requires explicit approval of exact replacement wording; these proposed corrections are not applied to the canonical master or saved drafts:

1. `A research brought me to {{development}}.` → `My research led me to {{development}}.`
2. `{{sender}} at {{company}} asked me to research potential business partners and write to relevant people on his behalf.` → `{{sender}} asked me to research potential business partners for {{company}} and write to relevant people on his behalf.`
3. To avoid inserting the same value three times, retain the first benefit slot, remove `That means – {{outcomeSummary}}.` from the capability paragraph, and replace the final repeated benefit sentence with `You can share your requirements and assess whether {{company}} is the right partner.`

The screenshot does not prove the saved sender name is wrong: the user must choose the intended sender identity. The generation fix does not change existing CRM messages, send outreach, or replace protected originals. Provider-response and signed-in customer acceptance remain separate from local test and release proof.
