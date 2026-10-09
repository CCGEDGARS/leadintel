# Meeting platform options

Settings now offers Zoom (legacy default), Microsoft Teams and Google Meet. Preference is persisted as `brandIdentity.meetingPlatform` through the existing workspace state and sender identity save/sync path. Opening settings or switching workspace restores the corresponding choice.

Controlled personalization adapts the working invitation, including email and LinkedIn styles. AI generation and rewrite prompts receive the selected platform. AI draft validation accepts the selected platform and rejects mismatches. The Messages sender summary shows the choice. Original approved scripts and subjects are preserved byte for byte; historical message bodies are not rewritten on setting change. Active drafts require fresh review through the existing sender-change invalidation path.

This preference does not configure Calendly's event or connect conferencing accounts. Users must select the same conferencing location in Calendly. Calendly generates the meeting URL when booked; LeadIntel continues to use the existing scheduling URL and booking webhooks.

Validation includes all supported styles on both channels, preference normalization and reload, cross-workspace precedence, AI prompt/parse checks, Settings DOM save/reopen/switch, the full customer suite, syntax checks, static build and exact-SHA production smoke checks.
