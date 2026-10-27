# Gemini-first book engine

User authorization: “install gemini as primary engine for books and skills and implement all the other suggestions ... to speed up the process.” Builds on the approved three-way research and single-pass release.

Use connected Gemini and its saved model for book analysis and unfinished skill generation independently of the workspace active chat/writing provider. If Gemini is absent, preserve compatibility with the active provider and clearly label that fallback. Do not switch providers after a billed failure, create credentials, change active settings, or repeat completed work. Prepared skills require no AI connection.

Replace synchronized waves with three continuously occupied worker slots, bounded by the same workspace lock, launch deadline, section attempts and batch bounds. Increase the invocation cap from 24 to 60 sections, with a tested D1 budget below 500 queries for remaining skill generation, to reduce scheduler round trips. Stop scheduling on first failure and drain started work. This removes waiting for the slowest section of every wave without increasing concurrency.

Display configured next-batch engine and fallback reason in both library tabs. Retain honest percentage/speed/ETA and usage disclosure. General assistant and writing routes are unchanged.

Provide a reproducible opt-in offline comparison tool using identical beginning/middle/end sections across the three exact models, common prompts and output validation. Record elapsed time, usage, valid output and safe errors; save generated methods for human semantic review. No invented semantic quality score, automatic speed winner, paid benchmark on upload, or claim of live measurement without actual receipts. Existing native PDF recovery remains an independent bounded operation; whole-book visual transcriptions and priority tiers can add cost and are not prerequisites to this speed change.

Alternatives: changing the globally active provider also changes unrelated tasks; running all three per book triples work; raising concurrency risks rate limits. Task-specific preference and work-conserving slots avoid these costs.

Acceptance: Gemini selected even inactive; no cross-workspace credential access; active fallback only when missing; errors stay visible; zero calls for cached skill; continuous slots never exceed three and honor failure/deadline; actual next engine displayed; comparison produces honest receipts and never leaks keys. Full suites, build, fresh review, exact-SHA production proof.
