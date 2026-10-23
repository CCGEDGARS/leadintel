# Writing Assistant implementation plan

Spec: docs/superpowers/specs/2026-10-23-writing-workspace.md. Full execution authorized by user.

1. Backend general-context boundary and session-only retrieval. Test no automatic customer facts, blank creation, optional identities and session books; preserve existing customer constraints.
2. Transient book API and upload/settings cleanup. Test multiselect, reset, deletion, isolation, no PATCH on main toggles.
3. Durable general library with CAS and workspace/user isolation. Test auth, exact text, reload, stale writes, limits, no CRM side effects.
4. Editor/controller and context integration. Test preview/advice intents, clear/undo, context switch cancellation, general load/save/copy, approved customer working alternatives, source resets and optional books.
5. Full suites, fresh-context review, build and browser checks. Release exact SHA through CI and release-integrity proof. Verify main-interface books and both writing modes without sending outreach.

Parallel agents own distinct backend, selection and general-library files. Root owns editor/controller/context/outreach and integration. Decisions: general drafts saved in dedicated tables, not expanding workspace JSON; main source selection uses explicit ready refs rather than durable global activation.
