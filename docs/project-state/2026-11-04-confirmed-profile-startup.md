# Confirmed profile authority during startup

Release verification of the email-only Buyers Proceed rule exposed intermittent Delivery acceptance failures. Controlled CI Chromium diagnostics showed that both message approvals and sender authority remained current, while the Strategy signature changed during `app.init` and `saveState`. Delivery correctly rejected the changed source context.

The only changed Strategy input was `profile.customerPainPoints`: ordinary profile normalization regenerated a fallback even though the canonical field was already `user_confirmed`. Its old flat display status still said AI-inferred. Canonical normalization restored the confirmed value, so script load order determined the outcome.

CompanyBrain and BusinessIdentity now preserve the canonical user-confirmed value when normalizing a legacy generated field. Existing display metadata stays unchanged so a cosmetic migration cannot invalidate an otherwise valid saved approval. Explicit newer confirmed profile edits remain intact. Inferred canonical records are not promoted. Real answer or source changes still invalidate approval.

The Delivery fixture projects canonical fields before capturing Strategy and message approval authority. Regressions compare ordinary and canonical startup in both orders, including existing legacy metadata, JSON reopen, inferred negatives, newer manual edits and real context changes. The mandatory Chromium journey holds the canonical module until the authenticated Delivery page is ready, then completes the existing send, uncertainty, CRM recovery and reopen checks with intercepted fixture providers.

No production approval gate, message template, paid research policy or sending authorization was relaxed. Implementation tests, exact-release proof and authenticated private customer acceptance remain separate evidence gates.
