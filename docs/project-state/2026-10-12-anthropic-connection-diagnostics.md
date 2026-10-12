# Anthropic Test & save diagnostics — 12 October 2026

## Report and root cause

A customer screenshot showed an unsaved Anthropic key and HTTP 400 `invalid_request_error` while testing `claude-sonnet-5-5`. The provider adapter discarded the upstream explanation and retained only the error type. Anthropic uses this type for several causes, including insufficient API balance and spending limits. The screenshot cannot establish the customer's actual upstream cause; no private customer key or provider response was available.

## Fix

Classify recognized Anthropic balance, spending-limit, model-access and request-parameter errors into fixed safe messages. Never echo raw upstream messages, account details or keys. Unknown 400 errors remain non-payment errors and recommend checking model access/support. Apply classification to both credential verification and generation.

Failed first-time verification now updates the provider card, badge and System Health payment alert immediately without rebuilding or losing the entered key. Transient alerts clear on retry and workspace change. Failed verification does not save/replace a credential, change the saved model or activate another engine. Do not persist a replacement key's billing failure against the previously saved key.

## Regression coverage

Provider tests cover balance and limit classification, unsupported model/parameter errors, unknown errors and secret suppression. Real route tests cover PUT/PATCH rejection with the existing credential/model/active selection unchanged. UI tests cover first-time payment state and immediate clearing without replacing the input.

## Customer acceptance still required

The customer's original Anthropic request must be retried to identify its classified cause. If API balance or spending limits are the cause, the account owner must resolve them in Anthropic Billing & credits. This change cannot fund an external account or prove that the customer's connection succeeded.

Primary references: https://platform.claude.com/docs/en/about-claude/api-credits-for-subscribers and https://platform.claude.com/docs/en/api/rate-limits.
