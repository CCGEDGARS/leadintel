// Standard USD per million tokens, matching the workspace model picker. Keep the
// ledger in millionths of a dollar so concurrent reservations add exactly.
const rates = new Map([
  ['gpt-6-astra', [10, 50]], ['gpt-6.1-sol', [2, 10]], ['gpt-6-luna', [.1, .5]],
  ['claude-fable-5-1', [10, 50]], ['claude-opus-5-5', [4, 20]],
  ['claude-sonnet-5-5', [2, 10]], ['claude-haiku-5-5', [.1, .5]],
  ['gemini-3.1-pro-preview', [2, 12]], ['gemini-3.8-flash', [.75, 3.75]],
  ['gemini-2.5-flash-lite', [.1, .4]]
]);
export const spendIncrement = 1000000;
const pause = message => Object.assign(new Error(message), {code: 'research_spend'});
function price(model, input, output) {
  const rate = rates.get(model);
  if (!rate) throw Object.assign(new Error('Research paused because the selected model has no configured price. Choose a priced model in Settings.'), {code: 'research_price'});
  return Math.ceil(input * rate[0] + output * rate[1]);
}
export function spendLedger(state) {
  if (!state.reasoningSpend) {
    let used = 0;
    for (const [key, usage] of Object.entries(state.modelUse || {})) {
      const model = key.split(':')[1];
      used += rates.has(model) ? price(model, usage.input, usage.output) : spendIncrement;
    }
    state.reasoningSpend = {used, limit: spendIncrement};
  }
  return state.reasoningSpend;
}
export function reserveReasoning(state, model, text, maxOutput) {
  const ledger = spendLedger(state);
  // One token per UTF-8 byte plus message framing is a conservative input reservation.
  const reserved = price(model, new TextEncoder().encode(text).length + 256, maxOutput);
  if (ledger.used + reserved > ledger.limit) throw pause('Research paused before the next AI call would exceed the estimated reasoning budget.');
  ledger.used += reserved;
  return usage => {
    if (usage?.input_tokens > 0 && usage?.output_tokens > 0) {
      ledger.used += price(model, usage.input_tokens, usage.output_tokens) - reserved;
    }
  };
}
export function researchPrompt(prompt) {
  if (!prompt.pages) return prompt;
  const pages = prompt.pages.map(({url, text, links = []}) => ({
    url, text, links: [...new Set(links)].filter(link => !text.includes(link))
  }));
  return {...prompt, pages};
}
