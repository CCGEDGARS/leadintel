# Protected message masters and workspace versions

Built-in templates are immutable application resources, maintained through repository/deployment permissions. Customer workspace state has no route that writes these application resources. Backend customer-state writes require workspace membership and retain version conflict checks. Browser object freezing is an integrity measure, not an authorization boundary: browser owners can change their own local code or requests, but doing so cannot overwrite the deployed master resources.

The template API freezes each master and its array, derives effective template copies, and stores custom subject/body only in personalTemplates tied to a recognized source ID. Master names and metadata cannot be supplied by workspace data. Previous custom templates migrate into personal versions. Draft edits stay separate. Save my version validates subject/body; View protected original reads only the frozen master; Restore original resets only the selected override and invalidates draft approval.

Regression coverage: master mutation, workspace isolation, save/reload, restoration, legacy migration and spoofed metadata. No outreach sent and no user custom template overwritten during verification.
