-- Upgrade every existing OpenAI workspace integration to GPT-6.1 Sol.
-- Gemini and Anthropic integrations are intentionally unchanged.
UPDATE workspace_ai_integrations
SET model = 'gpt-6.1-sol',
    updated_at = CURRENT_TIMESTAMP
WHERE provider = 'openai'
  AND model <> 'gpt-6.1-sol';
