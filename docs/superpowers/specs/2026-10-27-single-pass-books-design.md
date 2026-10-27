# Single-pass book processing

User approved the preceding discussion: parallel section analysis, reuse work from upload for skill creation, compact deep output, clearer progress, and preserve all existing books/skill checkpoints.

New uploads are explicitly marked with a versioned method plan. Analyse the same stable 4k/200 source parts already used for skills, deriving writing techniques and summary from validated deep methods. Persist methods in existing metered chunk JSON and the private catalogue. Only after completed analysis/coverage review and the existing confirmation does Turn to skill create an enabled independent skill. A complete, validated prepared catalogue can be packaged without provider requests. No automatic skill activation during upload; 3-book/30-skill/0–3-applied limits remain.

Legacy uploads retain their original chunk plan and technique format; no restart or silent paid re-analysis. Existing skills reuse every saved chunk/part. Legacy analysis is supplied as compact hints for remaining skill sections.

Use three parallel requests per workspace, protected by a shared durable workspace processing lock across upload/skill jobs. Run consecutive waves within a bounded invocation (24 units / four minutes; allow in-flight calls to drain). Cron remains crash recovery and continuation between bounded invocations. Stop new launches on failure, drain and checkpoint successes, respect bounded retry/backoff, and preserve lease/deletion/revision guards. Do not introduce a new cloud queue dependency or promise zero scheduler delay. Quota accounting, owner isolation, partial coverage/native extraction review, protected templates and advisory boundaries remain mandatory.

Progress includes saved count, percentage, last saved time, observed rate and estimated remaining time only with enough new samples. Old saved sections are a baseline, never counted as new throughput. Refresh polling must not continually disable controls or display a misleading loading state.

Approaches considered: larger requests risk recurring timeouts; a faster model changes the user's chosen provider; a new queue needs new deployment permissions. Chosen: one reusable analysis plus bounded concurrency using the existing Worker/cron/D1/R2 stack. This reduces duplicate AI work and waits; no numerical provider speed promise without measurements. New initial analysis does more work than the old summary-only pass.
