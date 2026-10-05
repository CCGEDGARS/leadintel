# LeadIntel checkpoint — 5 October 2026, 22:46 Riga

## Stop and resume
Edgars asked to save the session and continue on 6 October. Do not implement the
newly discussed design while paused. Resume from these decisions, preserving
existing customer data. No outreach sending is authorized.

## Implemented and verified earlier in this session
- Safe navigation-only sync merge, exact conflict diagnostics and recovery copies.
- Toolbar correction; recovery download appears only during an active matching-
  workspace conflict, preserving backups after resolution.
- Seven elevator-pitch fields and preview. Existing settings, drafts and custom
  templates preserved; unknown problem input blocks generation.
- Last verified production SHA: 8190cef26077413683aafdd73ccbb4efe8c75aba.
  Release Integrity run 37351197711: exact-SHA proof PROVEN, CI success, matching
  manifest, backend health and 33 smoke checks. All 1,746 customer tests passed.
  Browser showed all seven fields, Joakim selected, saved email draft retained.
- Customer said the earlier sync conflict appeared solved. Recovery JSON showed
  older Johan/LinkedIn local state against newer Joakim/email server workflow.
  Recommended Use server version with both copies preserved.

## Approved next design — NOT yet implemented
Replace the elevator-pitch form in Messages with compact message settings,
three separately saved editable templates and expandable source information.
Professional Template, NLP Template, Friendly Template; retain AI Original.
Activate on demand. Draft edits must not change a saved template. Reuse approved
Step 2 answers and researched recipient context rather than duplicate entry.
System completes missing wording, never missing facts. Essential unknown facts
request input; optional unsupported claims are omitted.

### Twelve Step 2 questions (currently only ten in code)
Keep current targeting and research quality; add two questions and refine wording.
All twelve require review/confirmation. Explicit honest unknown/no-approved-proof
answers are allowed; do not require fabricated positive claims.
1. Which products or services should we prioritize?
2. What does your best-fit customer look like?
3. Who makes or influences the buying decision?
4. Which prospects should we exclude?
5. What problems or unmet needs usually create demand?
6. Which observable events suggest that demand may exist now?
7. What practical improvement do customers gain—and why does it matter to them?
8. What makes your company meaningfully different, and what do you care about delivering?
9. Which real customers and projects can we reference, and what measurable results
   did you deliver? Include customer name, project, contribution, metric, baseline,
   timeframe, supporting source/link and permission to use the name and figures.
   Confidential cases need an approved anonymized version. Average savings require
   multiple measured cases; one result stays a case example.
10. What concerns commonly stop customers from proceeding?
11. How do you deliver the improvement? Explain your approach in simple terms.
12. What useful thing can a prospect gain from the first 30-minute meeting?
    Include the relevant evidence, data or practical insight we can actually bring.

Use exact relevant wording from the agreed message as clearly labelled examples,
never as automatically saved facts or runtime seller defaults.
Proposed gates agreed in discussion: company research requires questions 1–6
confirmed; message generation requires all 12 confirmed; sending requires
approved message, confirmed recipient and required settings. These gates are
NOT implemented yet. Preserve migration of old ten answers and confirmations.
Fix current message problem mapping: Step 2 buying_outcomes/customerPainPoints
exists but message seed currently reads customer_problem/customerProblem.
Keep sender identity, signature, language and Calendly in message settings.

## Mandatory business-value rule
Every style must assess: earn more money; save costs; simplify/improve execution.
Connect all three whenever credible, leading with the buyer's most relevant
benefit. Explain the mechanism; use approved proof and verified numbers.
Do not force an unsupported revenue/profit claim or invent metrics.
Potential benefits remain possibilities, not guaranteed results.

## Professional Template structure and approved wording
Opening: specific verified company development -> keeping things running
smoothly -> question about buyer responsibility. Keep the words “I noticed”.
Prefer “run smoothly” or “manage” over “coordinate/coordination”.
Exact approved Joakim opening:

Hi Joakim,

I noticed LKAB’s investment in the new sorting plant in Malmberget. Keeping a
project of that scale running smoothly can take considerable time and effort.
Does your role involve finding reliable partners and managing suppliers for
this project?

Then introduce sender/seller, meaningful difference and relevant capabilities.
Describe a possible buyer challenge without claiming it is established.
Include one real comparable customer/project with approved measurable result.
Meeting offer must name useful evidence/insights and tie directly to the
specific expansion, country, facility or investment instead of vague “future
projects”. Invite to a 30-minute Zoom conversation, immediately followed by
one Calendly action, then signature.

Template data structure:
- Verified project/development + personal observation (congratulations only
  for a verified relevant achievement attributable to the recipient).
- Sender/company specialization, meaningful difference and human benefit.
- Possible challenge, credible practical outcome and simple delivery mechanism.
- Real relevant customer/project, result, baseline/timeframe and optional
  approved proof link.
- Concrete meeting value tied to the named customer development.
- Booking action and signature.

Never assume Joakim personally leads the sorting-plant project. Reverify
project specifics/currentness before producing sendable copy. No confirmed
ERCON cost-saving/delivery-time case figures have been supplied; placeholders
must not be promoted to facts. Calendly is still missing in saved draft.
Confirmation/Zoom-link delivery claims require verified Calendly configuration.

## Next session priorities
1. Read this checkpoint and repo AGENTS/release rules; inspect current main.
2. Implement 12-question schema/UI, confirmations, migration, profile mapping,
   generation gates and illustrative examples without weakening research.
3. Refine/save Professional template with approved opening and numeric proof;
   collaboratively create NLP and Friendly versions. Keep ethical reframing,
   pattern interrupts and future pacing evidence-grounded.
4. Replace elevator form with settings plus reviewed source context; wire full
   seller and recipient evidence into generation (current prompt is incomplete).
5. Extend proof URL handling: current message parser permits only Calendly,
   so approved source links need a narrowly validated allowlist, not arbitrary URLs.
6. Test preservation, save/reload, CRM provenance, recipient/workspace isolation,
   stale results, all templates and benefit assessment. Exact-SHA production
   proof and authenticated visible checks before completion claims.

This is a saved decision record, not a claim that the next design is deployed.
