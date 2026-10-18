# Companies step audit

Confirmed with the user's screenshot and a signed-in five-company audit run:
- Amount was persisted in discovery metadata but the progress model read only discovery state. It now reads the selected metadata and refreshes immediately after edits.
- A status render could run before lazy Discovery state existed and dereference null. It now waits for initialization.
- No visible Cancel on Companies. The page now exposes the existing registered task cancellation, keeps completed evidence/selections, and locks the amount during a run.
- Empty-state copy could claim it was finding domains while checking purchasing fit; initial status could show 0/0. Status and empty-state text now share phase-aware copy with a safe preparation state.
- The selected count appeared twice. The redundant detail is hidden, with explicit CSS overriding the previous display:block rule.
- AI extraction failures were caught but excluded from final failure accounting, allowing an incomplete run to be treated as a clean no-match and automatically broadened again. Failures now enter the existing diagnostics and outcome accounting, persist as extraction failures, and trigger a full retry. Automatic continuation also checks the original workspace and strategy before starting another pass.
- Extraction prompts previously serialized the entire saved profile without bounds. They now include bounded relevant targeting fields, reference traits and source text, preserving exact supplied URLs under the API's 80,000-character input limit.
- Zero qualified companies no longer falsely implies that no company names were identified.

The audit run identified/reviewed real companies but returned no fully qualified selections under the current rules, with extraction/provider warnings. It was stopped through the existing task control after collecting sufficient evidence. Qualification gates were not relaxed; no messages were sent and no test companies were added to CRM. Existing research was retained.

Regression coverage includes lazy startup, immediate progress updates, cancellation, phase text, prompt size, extraction failure accounting and reload. Full tests, build, exact-SHA production proof and signed-in controls must pass before completion.
