# Writing Assistant: visible manual Edit action

The user requested an Edit button above the working draft, alongside Clear draft and Load script. The subject and message already accept typing, but the toolbar did not expose that action.

Keep the existing inline editors and autosave. Edit is the first toolbar button; it refreshes the current context, focuses and scrolls to the message, and explains that subject/body changes remain in the working copy. It follows existing busy/save disabling. Empty/general drafts remain editable without AI or books. No new lock/unlock state or save mode is introduced.

Manual input continues through the existing controller, exact-text local recovery, Undo and Restore original. Use in Messages remains the explicit customer handoff; it requires subsequent review and never approves or sends. Protected master templates are unchanged.

Regression coverage uses the real controller and UI for button position/focus, zero AI requests or mutations on Edit, exact subject/body save/reopen, explicit handoff, busy/cancel behavior, blank general writing and account/customer context changes. Four new cases first failed for the missing action, then passed; 35 focused writing checks passed.

Cache versions follow index → Discovery loader → outreach UI → Writing Assistant UI. Full customer test/build and exact-SHA release results are recorded in the release PR. A public artifact check does not imply authenticated visual acceptance.

Validation observed: **3,760 customer tests passed, 0 failed** under Node 22. Build/startup isolation, syntax and diff checks passed. Independent read-only review found no issues and additionally verified the deferred-save disabling/recovery behavior. Exact-SHA production evidence is retained in the release PR.
