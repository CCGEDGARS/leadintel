# Elevator-pitch core — 5 October 2026

Replace company-profile labels with seven editable pitch elements: who we
help, problem we solve, outcome we deliver, how we do it, why choose us plus
proof, why meet, and what to do next. Sender, company, language and Calendly
remain separate message settings. Show a plain-text core-pitch preview that
updates while editing. Meeting value is immediately followed by the action.

Retain existing offer/target/value/proof/meetingValue storage keys and drafts.
Add problem and nextAction, normalize to schema version 2, upgrade only untouched
default templates, and preserve custom templates. Differentiation and approved
proof seed the single combined field. Do not invent a customer problem; unknown
problems remain empty and block new generation until entered. Proof is optional.
The next action defaults to choosing a time through the supplied Calendly link.

All three saved template styles and AI-original prompts use this structure.
Buyer problems remain hypotheses unless reviewed evidence establishes them.
Existing URL validation, preview-calendar marker, approval gates, workspace and
buyer race guards, and CRM script provenance remain in force. Outreach is not sent.

Regression checks cover migration, custom-template preservation, save/reload,
CRM snapshots, cross-industry seed isolation, preview order and generation.
Production proof and visible customer checks must be reported separately.
