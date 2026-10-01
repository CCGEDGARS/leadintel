# OpenAI discovery recovery

Repeated timeout exports do not establish a billing failure. Discovery previously sent no hosted-tool or output bounds and used the model default reasoning effort. General discovery now uses at most two hosted search calls, 4000 output tokens and low reasoning effort for GPT-5/6 models. This bounds work; it cannot guarantee upstream availability.

OpenAI retry previously truncated each merge in arrival order, discarding new findings when the saved pool was full. Retry now merges all candidates, ranks using evidence quality and seller offers, then caps. Recovery preserves source data and ranks again. Failure timing and attempt metadata survive normalization.

High opportunity confidence requires extracted pages from independent domains; failed evidence quality gates cap stored and displayed confidence at Medium, including reports. Numeric fit scores remain distinct from evidence confidence.

Validation: customer and backend suites plus static build. Production proof and an authenticated real provider run are separate acceptance gates. This session has no authenticated workspace/provider credentials; mocks cannot establish a successful real OpenAI search.
