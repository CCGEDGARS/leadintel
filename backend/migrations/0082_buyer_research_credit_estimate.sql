-- Stage 2 of the Buyers credit brake. A request whose cost Firecrawl did not report was interrupted before its
-- answer (every answered request reports its cost). `unreported` keeps the most such requests can have cost, which
-- is what the page shows; `unreported_estimate` is their ordinary price, which is what counts toward the limit.
-- 22 Nov 2026, live: two interrupted page reads stood at 20 credits by the worst case and were billed 1 each at most;
-- in the receipts of 19-22 Nov, 90 of 430 Buyers requests were interrupted.
ALTER TABLE buyer_research_credits ADD COLUMN unreported_estimate INTEGER NOT NULL DEFAULT 0;
