# Step 6 user-approved corrections — 2026-10-12

Evidence: user screenshots and explicit instructions, with prior Writing Assistant scope confirmed from October 12 discussion. Do not change production until regression verified.

## User decisions
1. Sender & settings and Languages & translations must have equal visual width/height and aligned layout.
2. Protected approved reference scripts are MANDATORY default for core email (Professional/NLP/Friendly/Brutal). Current shorter email was automatically generated according to user, NOT manually rewritten; classify P0 active-editor/default contract breach. Preserve historical edits but fix default provenance/renderer.
3. Remove separate 'Sources' panel from Writing Assistant UI because redundant to the established reference-material facility; avoid deleting stored files or disabling research provenance.
4. Writing Assistant must follow previously approved concept: contextual chat using current buyer/company/research/unsaved draft, optional uploaded reference PDF/book sources with selected roles, Apply/Discard preview; actions Shorten/Rewrite/Reset possible but only explicit user initiation; approved originals inviolable; writing skills deferred until stable. Existing implementation likely has chat/preview but UX appears fragmented; audit capabilities before rebuilding.
5. Outreach Tools shown only when requested (collapsed by default); library, custom style templates, content and approved originals still accessible.
6. Step 1 'Prepare for an event' selection controls event route; event setup opened when enabled and context carries through; Step 6 event invitation highlighted/expanded automatically only when activated; normal emails unaffected. Separate event-specific Writing Assistant and event script library required (scripts not yet available, so don't invent approved ones). No unsolicited event generation; only click. Do not duplicate separate Events & Conferences button.
7. 'Advanced research & campaign settings' role is unconfirmed from screenshot; audit its actual children, state and service calls before decide HIDE/MERGE/REMOVE. Keep collapsed until evidence justifies anything visible.

## Tests
- Full DOM render default matches exact approved original + allowed substitutions; screenshot and fixture compare. Never conflate user's saved editor draft with approved original.
- Equal cards layout at desktop/mobile breakpoints.
- Assistant source states and preview/Apply/Discard tested; legacy uploaded materials preserved.
- Event condition Step1 off/on, screen mounting, activated invitation, separate saved draft and zero automatic paid calls.
- No duplicated source UI, no unplanned removal of storage or service functions.
