# Messages follow-up assistant — product decision 2026-10-12

Approved direction: prioritize a Follow-Up Assistant over an exposed 'Advanced research & campaign settings' section in Stage 6.

## Scope
- Analyze inbound customer reply, entered by paste or read from explicitly authorized connected mailbox.
- Read the correct previous *sent* message and conversation chronology from workspace CRM if available, not merely the current unsent draft.
- Classify explicit intent: interested, question, objection, referral, timing delay, decline/opt-out, out-of-office, ambiguous. Use evidence-linked reasoning and confidence, not fabricated psychology.
- Suggest respectful next-best action, including no reply for opt-outs.
- Draft concise replies in Professional / Diplomatic / Direct / Consultative style (user editable), no automatic send.
- Also support a separate mode for no-reply follow-ups with verified last-contact date, frequency cap, opt-out and suppression checks.
- Save drafts and approved communications to CRM/Delivery with workspace isolation, audit trail and human approval.

## Placement / reduction
- One collapsed Follow-Up Assistant under Messages after main outbound draft. Its details open only when needed.
- Investigate the actual contents of Advanced research & campaign settings before moving/hiding. Do not delete any underlying research, sending guard or scheduling configuration without dependency audit.
- Keep Stage 6 first-contact protected originals strictly unchanged; follow-up replies are distinct messages and may use different scripts.
- Avoid duplicate Writing Assistant: general Writing Assistant edits first-contact drafts; Follow-Up Assistant specifically analyzes incoming response and recommends a next conversation step.

## Tests
- Positive interest, genuine question, objection, referral, polite rejection/opt-out, automated reply, ambiguous reply, no-reply timeout.
- Correct message threading and identity, CRM save after approval, no auto-sending, cross-account isolation and no invented buyer facts.
