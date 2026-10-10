# Saved workflows and Ercon pilot — product decision

Recorded 2026-09-29. The first customer pilot is Ercon targeting Sweden. The same product must later support Edgars's own LeadIntel plus training customer acquisition without mixing campaign data.

## Outcome

The owner enters company and offer data once, saves a market-specific workflow, checks the quality of trigger evidence, buyers and tailored messages, and can let a proven workflow run within explicit limits. The owner can intervene at any time. Automation is not considered proven by a successful scheduler run alone; the pilot must produce credible prospects and messages the owner would send.

## Workflow hierarchy

- **Workspace:** company profile, offers, brand, sender connections, CRM, provider keys, and shared suppression and daily sending limits.
- **Workflow:** named target region and segment, language policy, ICP and exclusion criteria, selected triggers and monitored sources, evidence thresholds and freshness rules, buyer roles, contact verification policy, approved trigger playbooks, message strategy, follow-up policy, and delivery mode. Each workflow has an owner, version, timestamps, and Draft / Ready / Active / Paused / Archived state.
- **Run:** immutable settings and playbook version, company and contact decisions, source URLs and dates, rejection reasons, generated drafts and approvals, queue state, Gmail IDs, replies and CRM outcomes.

Duplicate Ercon → Sweden to start Ercon → Norway; changing a region must not overwrite Sweden. A change to a trigger rule, evidence threshold, approved script, or recipient policy creates a review-required version before automatic sending resumes. Preserve prior run attribution. Updated by the 10 October user agreement: My Flows supports ten saved flows and at most two automation-enabled flows per workspace. Database triggers enforce both limits, including concurrent requests. Active flows share mailbox limits and sending windows and retain workspace recipient deduplication. Synthetic executor tests prove isolated orchestration; actual provider throughput and customer outcomes still need independent acceptance.

## Trigger playbooks

For each trigger type, store the commercial hypothesis, relevant offers and buyer roles, required source evidence and freshness, exclusions and ambiguous examples, safe claims, tailored email and follow-up guidance, language, owner approval/version, and tested examples. A generic signal keyword alone does not justify saying the prospect is buying. Low-confidence or unsupported messages require review. Show why the company qualified and exactly which source supports each personalized assertion.

## Current implementation and gaps

- **10 October:** My Flows adds dedicated authenticated saved-flow storage, separate working snapshots, duplication review, flow-specific approvals, immutable run attribution, guarded switching and execution via the existing qualified workflow engine. The legacy singleton and its history migrate without duplicating jobs. Website/business inputs, sender, connections and approved original libraries remain shared. Per-flow snapshots stay outside the single customer-state dataset.
- Message campaign presets persist in workspace state (up to 30). Market monitoring currently stores one config per workspace. These are not complete saved workflows.
- Company Discovery uses an active Reference Customer model to add a market-scoped lookalike query and prioritize qualified results. Review priority blends the independent opportunity score with resemblance, weighted by model confidence (12% low, 20% medium, 25% high). The UI shows the evidence-based opportunity score and separate past-customer resemblance; resemblance alone never qualifies a company or asserts buying intent. With only one low-confidence reference customer, treat resemblance as exploratory.
- Monitoring runs and alerts exist, but lack a workflow identity linking trigger evidence through buyer selection, draft, approval, send, and outcome. Discovery and outreach can use signal names, yet the generated opening may remain generic. Validate with real Ercon/Sweden examples.
- Automatic delivery remains `manual_only` in production. It queues an approved message for a verified CRM work email only when explicitly enabled. The pilot must test real Gmail send, reply and stop behavior before enabling it.
- A workspace-wide contact do-not-contact table now blocks manual Gmail/Microsoft sends and automatic queueing/sending. New unsubscribe replies from Gmail sync and the automatic reply poll add the address and cancel pending automatic queue items. The owner can add a contact in Delivery. Backfill of older replies, objection handling, appropriate unsubscribe mechanics, and market-specific lawful basis still need validation before unattended sending.
- Open rate and booked meetings are not verified metrics. Report Gmail-confirmed sends, classified replies and actual CRM meeting outcomes distinctly. Add bounce and delivery-failure handling, sender authentication checks and appropriate unsubscribe mechanics before scaling.

## Manual and automatic implementation boundary

The Ercon → Sweden pilot remains Manual. Automatic delivery stays disabled by the production flag. The user may save a daily limit without causing a send. Automatic research-to-message progression is not implemented by the existing market-monitoring scheduler: alerts do not become verified companies, buyers, grounded drafts or approved messages on their own. My Flows now connects saved settings to the approved staged workflow runner. Activation still requires all stage approvals, duplicate review, final owner approval and the production delivery flag. Do not represent synthetic stage tests as actual provider, delivery or customer outcome acceptance. A change to any material rule pauses automatic progression until the owner reviews the new version.

The first shared guardrail is a workspace-wide contact suppression list. It survives workspace resets because it belongs to the signed-in workspace, not the current pilot state. Owner-entered addresses and newly observed Gmail unsubscribe replies are blocked before manual/automatic sends; scheduled queue items are cancelled. Do not switch on automatic Gmail until the full workflow, one controlled send/reply/stop test, and market safeguards pass.

## Next acceptance sequence

1. Run the Ercon → Sweden workflow manually on a small real-company sample. Inspect source URL/date, offer fit, selected buyer, email verification and false positives.
2. Write and approve trigger playbooks; generate evidence-linked, company-specific Swedish-market drafts and reject weak examples.
3. Implement durable saved workflows, versions, run attribution, suppression and cross-workflow deduplication. Exercise duplicate-region and pause/restart flows.
4. Test one controlled Gmail recipient and reply, including suppression and follow-up cancellation. Start a five-email-per-day pilot only after the end-to-end checks pass.
5. Measure qualified companies, verified buyers, approved drafts, replies, conversations, meetings and proposals. Apply the proven pattern to Edgars's separate LeadIntel plus training acquisition workflow.
