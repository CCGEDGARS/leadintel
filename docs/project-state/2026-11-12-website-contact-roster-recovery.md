# Website contact roster recovery after real-source replay

Owner request: visible controls on every contact and actual LinkedIn checks for all retained identities. PR942 implements the controls and double-query review. Replaying the complete supplied company's official page and indexed receipts exposed additional roster failures; this repair is required before treating the journey as complete.

## Observed evidence

The actual Sun Finance about-us extraction publishes 11 staff names: nine leadership contacts plus two named corporate routes. The generic parser returned ten actual names plus the role heading Europe HUB CEO, and omitted Gatis Treimanis. The full-source replay, not a screenshot alone, reproduced this. Indexed profile results also used Group Head of HR versus Head of HR and Investor Relations versus Group Head of Financial Planning and Analysis. A named Roman Kornienko query returned a Cyrillic-name profile; that query is evidence for the requested contact and must not manufacture another independently confirmed person.

The separate public-profile audit covers 12 names, including Aleksandrs, who was found through professional sources rather than that leadership page. These two counts describe different source coverage. Neither is a private workspace inspection or contact-ownership/deliverability check.

## Authoritative repair

- Share the official staff-card reader between fresh acquisition and saved-result recovery. Recover explicit English leadership cards alongside existing local-language cards. Restrict name/title matching to one heading and its following non-heading title line; an adjacent section heading must not swallow the first employee. An all-caps officer acronym in the proposed name is a role heading, not a professional identity.
- On the version-2 saved identity repair, re-read only retained, dated, unarchived, actually acquired official page bodies. Restore missing actual names once, keep existing IDs, retire unsupported headings with their original evidence, and keep newly restored people pending until mandatory checks run. A completed row becomes incomplete when restored people need checks; the replay itself starts no provider and cannot extend a deadline. The existing native missing-check command performs its normal bounded five-minute pass. Canceled and time-limit stop behavior remains intact.
- Canonicalize obvious Group/Global role-prefix variants and CRO/CLO wording. Different official duties remain held. A current, dated same-profile match may join an official/indexed alias with different published role wording; keep every title/source in roleSourceVariants and archive the removed alias. Independently saved paid outcomes never silently combine. Original paid data, CRM links and confirmation/context guards remain.
- Treat a retained person's named profile query as matching evidence, not a new roster-discovery request. Broad company discovery remains unchanged. Cross-script profile results remain visible unconfirmed candidates in the original person's review.
- Version saved repair and its customer cache entry together. Publish role wording and source links in the card. Ordinary Buyers role qualification, shared query plans, master scripts, paid approvals and sending are unchanged.

## Acceptance

Red/green cases reproduce role-as-name, role aliases, same-profile wording, distinct official duties, spaced English staff headings and a named-query Cyrillic candidate. Real SQL and the registered app.scheduled wrapper verify acquisition and no paid attempts. The authenticated legacy browser journey now seeds a missing actual staff member and a persisted role heading; native open must retire the heading, restore the missing person, queue all missing LinkedIn checks once, preserve retained IDs, save actual receipts and reopen on desktop/mobile without repeating provider work. The original Stop/Resume, context-race and source-failure journeys remain.

A controlled roster-only replay of the actual retained full company page and indexed query receipts produced 11 actual names, restored Gatis, excluded the role heading and had no false namesake conflict. The contact-check hook was controlled for that roster diagnostic; it does not establish completed live contact research. The actual public double-query audit and the authenticated controlled query/scheduler/browser tests provide separate evidence.

## Compatibility and rollback

No schema migration. Existing source, CRM and paid receipts remain. Newly restored identities get new stable IDs; old actual IDs are retained. Unsupported names are archived rather than erased. The prior release can ignore the additional role wording and review version, but its older parser can reintroduce the displayed defect; rollback is not a data-deletion action. Exact-SHA CI, deployment, backend health and mandatory release proof are required independently of private customer acceptance.

Local verification: 45 focused backend cases passed without skips; all four authenticated website-contact browser journeys passed. The updated desktop/mobile legacy journey confirms the missing staff restoration and role-heading retirement through native requests and the registered scheduler. Static build, syntax, full customer CI and exact production proof are separate gates.
