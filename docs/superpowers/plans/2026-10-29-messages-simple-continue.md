# Consistent Messages fields and one Continue action

Approved discussion: keep the email first, rename Meeting options to Meeting & calendar, put collapsed Tools directly below it and one Continue to Delivery action beneath both. Give top language controls and other main fields matching width, border, padding and spacing; retain natural heights for their contents. Restore selected template remains secondary and optional.

Use existing Messages → approved package → Delivery handoff. Continue saves the exact visible working email if needed, verifies recipient/workspace and real missing requirements, and captures an explicit current-draft review receipt bound to exact text, user/workspace, buyer, domain, language and current context. It does not regenerate text or mutate canonical originals. A matching receipt lets the deliberate working version proceed despite template/context selection differences; changing text, recipient, account or context invalidates it. Existing source evidence, event validity, sender, translation validity, CRM persistence and delivery/send approvals remain enforced. Previews and unfinished subject choices require resolution; save failures never navigate or send.

1. Add pure receipt ownership/invalidation tests and failing DOM/flow tests for layout order, equal field styling, optional restore, single button, Continue-save and failure/race guards.
2. Implement receipt helper and direct Continue orchestration; keep current snapshot approval/send contracts and add a distinct pre-handoff readiness action for real requirements.
3. Align major field classes and styles, rename the calendar section, move Tools inside the message column directly above the footer, and keep optional diagnostics contextual.
4. Update affected assertions and caches, run focused then complete customer tests/build, and publish a reviewable PR. Deployment needs separate explicit authorization for this new change.
