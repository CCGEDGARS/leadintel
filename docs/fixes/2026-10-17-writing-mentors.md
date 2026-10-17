# Writing Assistant — three-book workspace

The right column previously reserved most of its height for an empty conversation while hiding source material behind a collapsed library. The assistant now starts with three visible source cards, a clear selected state, and sourced ideas where learned techniques exist. Empty slots explain how to begin; they never show invented book content.

The editor remains a single recoverable working draft. The right column scrolls independently and contains books, source guidance, conversation, and proposals; the instruction composer stays accessible at its bottom. The redundant collapsed library strip is hidden inside the dialog. Manage books opens the existing canonical library overlay; Escape or closing the disclosure restores focus to Manage books. The layout stacks on narrow screens and uses smaller covers on short desktop screens.

Ready-book selection uses the existing library operation lock, expected source revision, API, and server-enforced single-active-source rule. It triggers the existing reference-revision invalidation. Processing/failed sources open management. Source changes never rewrite or save a draft automatically. Explore this idea explicitly requests a cited, supported alternative through the existing assistant, followed by the existing review/apply step. Customer research remains the factual context; mandatory originals remain protected.

The loader exposes presentation, slot, summary, and learned technique metadata to the workspace. Workspace changes clear local book metadata, and stale API callbacks cannot publish into another workspace. No backend/API changes, new AI calls on opening, or synthetic book recommendations were introduced.

Verification: mentor interaction tests cover empty uploads, revision-locked activation, pending and failed selection, source citations, explicit requests, inert source text, and draft preservation. Existing assistant source races, editing, save/handoff, keyboard navigation, uploads, deletion, and responsive stylesheet tests remain required. Production checks verify the exact source and layout artifacts and the selection bridge.
