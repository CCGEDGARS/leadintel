# AI provider hardening — 2026-08-24

Scope: make LeadIntel's three BYO AI provider integrations use current provider request contracts and robust credential verification.

Providers:
- OpenAI — Responses API, default model `gpt-5.6`
- Anthropic — Messages API, default model `claude-sonnet-4-6`
- Google Gemini — GenerateContent API, default model `gemini-3.7-flash`

Required behavior:
1. Credential verification uses a provider-appropriate minimal request.
2. OpenAI verification keeps the minimal Responses request fixed in PR #24.
3. Anthropic verification uses Messages with required `max_tokens`, one user message, `x-api-key`, and `anthropic-version`.
4. Gemini verification uses a minimal GenerateContent request without an artificial output-token cap.
5. Gemini generation uses the canonical `systemInstruction` request field.
6. Provider errors remain sanitized: status plus safe machine-readable code/parameter/status only; never provider message bodies or API keys.
7. Existing encrypted per-workspace storage and single-active-provider semantics remain unchanged.
