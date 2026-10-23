# Writing Assistant workspace — approved design

User authorized implementation of the complete discussion on 23 October 2026.

- Current customer and General writing modes. General mode has no automatic seller/buyer/research/flow data. Explicit customer/general mode changes keep the visible working text; switching customer/user/workspace restores that destination’s separate saved draft without importing the previous customer’s text. Both clear conversation and selected books, and invalidate pending proposals.
- Editable initial template, arbitrary pasted text, or empty draft. Clear both fields with Undo. Preview changes requests a full draft; a blank editor labels that action Generate draft. Ask assistant requests discussion. Quick actions request proposals; books optional. General Personalize requires explicitly supplied context rather than hidden buyer data.
- Zero to three session-only books, explicitly toggled on main cards; empty selection on every open, close, customer/workspace/context change. Upload/settings has details, replacement, learned guidance and deletion, no activation. Selection never writes global active flags. At least80% readable rule retained.
- Preview shows explanation and source citations; Apply changes edits the left working copy only. Existing drafts/master scripts are protected. Copy/Save draft/Save as template for general writing; Use in Messages for customer work clears prior approval and requires fresh delivery review.
- General saved drafts/templates have durable user+workspace-scoped storage and optimistic revision guards. Load script shows general saved records only in general mode. No customer CRM, flow, or send mutation from general actions.
- Keep explicit send approval, facts/citation checks in customer mode, stale-response guards, dialog keyboard and focus behaviour.

Implementation calls: backend request context.writingContext='general'|'customer', sourceSelection='session', intent='preview'|'advice'; selection sessionSnapshot/resetSession/toggleSession; independent general record API /api/writing-workspace.
