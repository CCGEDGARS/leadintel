# Company materials before Workflow settings

Setup's dynamically mounted Workflow settings card now follows the Company
materials panel, using the existing PDF input's parent panel as its anchor.
The optional materials controls and their identities remain unchanged; no source
content or saved data is moved. Existing market/sender anchors remain a fallback
for contexts without the materials panel. Cache versions cover the UI module,
its loader and the shell entry. A mounted DOM check confirms immediate adjacency
and preserves the PDF input node; existing workflow/qualification checks and
exact-release verification cover the change.
