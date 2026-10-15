# Optional Website monitoring

Website monitoring is a compact, optional card in Strategy, collapsed on page load. Its desktop action is right-aligned; mobile layout wraps it beneath the description. Set up monitoring / Edit settings expands inline. Close settings is available at the top and bottom. Saving closes only after server success. The collapsed card shows saved scope, frequency, research depth and execution status.

Disclosure state is transient and independent of monitoring.enabled. Closing never changes enabled status or removes saved configuration. Dirty close uses a native dialog with Save changes, Discard changes and Keep editing. Escape dismisses the dialog and retains the draft. Save failure leaves the draft open and the saved configuration unchanged. The existing strategy-activation gate and research providers remain unchanged.

Root cause corrected: saveMonitoringConfig previously called renderMonitoringControls before readMonitoringEdits, replacing form edits with the stored configuration. It now captures the draft first, commits local monitoring state only after the API succeeds, and preserves dirty controls during rerenders.

Verification: customer/test/monitoring-disclosure.test.js exercises initial disclosure, reopen, dirty close/discard, rerender preservation, successful payload/save, failed saves, explicit disabling and locked strategy. Existing monitoring UI tests now assert collapsed initial settings. Full customer suite and static production build are required before release. Production claims additionally require exact-SHA release integrity proof.
