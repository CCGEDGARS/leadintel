# Compact subject picker — 10 October 2026

The user requested hiding subject alternatives to save space and asked whether Malmberget and the other rows were already updated from system facts.

The five large radio rows previously remained expanded above the selected subject. The selected subject now stays visible above a native, keyboard-accessible Choose subject disclosure. Alternatives are collapsed on initial mount. Rendering preserves an open disclosure while the user compares choices; choosing an available subject uses the original canonical change handler and closes the disclosure. Empty/event-only pickers remain hidden. Disabled choices stay disabled. No subject/body, approval, saved text, template original or preference is changed merely by expanding/collapsing.

The supplied screenshot shows the first three Professional choices populated from project, sender and seller offer. The last two require material/technical context absent from the current resolved inputs. The current Professional project variable comes from a selected user-reviewed or source-verified trigger; it is not the Malmberget example in the immutable master. Source truth still requires inspection of that actual trigger's linked evidence. Other patterns use only their declared facts: sender/company, seller offer, project/material and technical question. Missing material context must not be filled by guessing steel or qualifications. Update message refreshes supported fields; it cannot invent absent facts.

Approved master wording and subject patterns remain unchanged. The governing policy now permits collapsing the alternative chooser while keeping all approved choices available. Changed module/CSS and parent entry boundaries use compact-subjects=20261010-v1. Production smoke checks require the compact chooser and accessible layout.

Regression checks cover collapsed initial mount, visible selected subject, all five options, disabled options, preserved expansion across render, canonical selection, automatic collapse after selection, unchanged body and hiding an empty chooser. Full customer tests, build, exact-SHA CI and production release proof are required before release claims. This is source-level verification; the authenticated customer's trigger source and profile fields were not read in this session.

Local validation: all 2,145 customer tests, JavaScript syntax and the static production build pass. The layout test checks that collapsed alternatives have display:none and expanded alternatives retain their grid.
