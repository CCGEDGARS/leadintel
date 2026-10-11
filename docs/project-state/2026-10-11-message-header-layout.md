# Message header layout — 11 October 2026

The new Update message and Add to flow controls were appended to a block container. With no inline whitespace or flex gap they touched. Update inherited a 43px minimum height while Add to flow measured 40px, and both inherited large primary-button shadows.

The header actions now use a wrapping flex row with a 10px gap, matching 44px minimum heights, explicit line height and border sizing, and no shadows. Update stays green; Add to flow uses an outlined secondary treatment. Disabled states use readable muted text rather than fading the whole button. On small screens the controls occupy their own row and wrap when needed. The agreed helper text stays below the header.

Only presentation and asset cache versions change. Message generation, Save, flow readiness and approval gates are unchanged. Verify rendered dimensions and separation after publication; DOM-only tests do not prove pixel layout.
