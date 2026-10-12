# Implementation plan

Execute natively under the user's implementation instruction.

1. Add failing provider and routing regressions; verify model defaults, grounded citation parsing, no-result/error fallback, cancellation and preservation of primary results.
2. Add bounded Gemini document adapter and native-extraction fallback with exact original preservation and page/coverage validation. Wire authenticated writing uploads to workspace credentials only.
3. Share research fallback between AI routes, workflow research and copilot. Ordinary company extraction uses the main engine. Keep existing evidence/identity gates.
4. Add main-engine labels, recommended model explanation, confirmed-model display and explicit confirmation. Secondary key saving preserves current main engine; failed verification preserves saved model. Add mounted settings regressions.
5. Run whole customer/backend suites and production build, inspect diff/master preservation, document limits and source links. Push reviewable branch/PR; apply repository release-integrity requirements before any production claim.
