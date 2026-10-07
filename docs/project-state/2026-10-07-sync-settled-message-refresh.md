# Clear stale Messages warning after recovery

Customer evidence showed Synced to LeadIntel in the header and hidden recovery buttons, while Messages retained its conflict warning. Messages listened to conflict/start events but not successful saves or the end of recovery. The keep-local fallback intentionally does not reload, exposing the stale display.

The bridge now emits sync-settled after clearing resolvingSync, restoring editing and unlocking recovery controls. Messages renders readiness on that event, including failed recovery, and on ordinary server-synced events outside recovery. Neither handler regenerates or changes drafts, cancels active generation on an ordinary save, or chooses a workspace version.

Regression coverage executes the real bridge busy-state function and Messages event bindings; checks success/failure refresh only after unlock, unchanged edited text, and ordinary save refresh without generation cancellation. Existing recovery tests cover version refresh/retry, both-version preservation and workspace isolation.
