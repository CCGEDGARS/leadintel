# Completed reference analysis must activate Lookalike

The earlier switch fix enabled only already-published reference models. It did not close the owner-reported gap between completed company analysis and a published, active portfolio model. The screenshot therefore correctly showed the unresolved legacy state, despite switch-policy tests passing.

Owner intent: completed usable analysis is sufficient. There is no extra model-publication approval step for analyzed references. One supported company is sufficient; unrelated reference companies may be used as individual examples without requiring shared traits.

Correction: recover a model deterministically from saved analyses with company-owned source quotes, including existing unpublished lists and newer completed analyses left pending behind an old model. Fresh supported analysis publishes automatically. A first portfolio migration enables a usable existing model instead of preserving an incidental legacy Off default. Explicit source-list exclusion after migration remains available. Empty uploads, unsupported classifications, other-company sources and unreviewed imports remain unusable. Manual source fields and unrelated workspaces remain intact; no research is rerun during recovery.

The reference resolver now loads before the app renders Strategy, rather than waiting for the optional AI editor loader. Strategy and Discovery use the same portfolio resolver. Regression coverage includes actual analysis-runtime -> synced list -> Strategy availability -> Discovery qualification, saved one/three-company lists, mixed industries, stable reloads, last-list deletion and source ownership.

The previous production proof established the previous source revision and smoke checks, not successful activation in this customer's authenticated workspace. This release adds specific recovery smoke checks; customer-visible state remains separate evidence.
