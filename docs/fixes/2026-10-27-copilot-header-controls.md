# Ask LeadIntel header controls

The 430px assistant drawer previously squeezed its identity, memory count, History, New and close controls into one flex row. Labels wrapped and the memory button stretched into a tall pill.

The header now uses two rows: title, context label and a separate close button above three equal-width controls. Memory and History use quiet dark surfaces; New chat uses LeadIntel gold (#bc8f2a). The controls have a consistent 40px minimum height, 9px corners, single-line labels, green hover borders and visible keyboard focus. Scoped selectors protect the drawer from shared button styling. Narrow screens retain the same hierarchy with smaller gaps.

Existing memory/history/new-conversation handlers and workspace persistence remain in place. Loader, drawer stylesheet and HTML cache tokens advance together.

Validation: all 58 existing copilot tests pass, including memory count/forget, conversation history, new chat and streaming behavior. Run the full Customer V2 CI and exact-SHA release integrity checks before claiming production verification.
