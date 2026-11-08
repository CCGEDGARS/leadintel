# Contact headings parsed as buyer identities

## Authenticated evidence

Kitron's first retained ten-person pool included `Investor Relations Contacts`, `Corporate Governance`, `Capital Markets Day` and the company office (`Kitron ASA`, title `Head Office`). Two of the labels had confirmed identity flags. The shared official inventory separately contained genuine sourcing and commodity-management contacts. These are parsing defects, not evidence that the headings represent people or that the genuine contacts have purchasing authority for the Danish project.

## Boundary and repair

Flattened navigation inside a staff section passed the shared two-word name check; adjacent navigation text was accepted as a staff role. The shared non-person-heading check now rejects these navigation categories. The staff-role check rejects office-location labels, so a company heading followed by Head Office cannot create a person card. No customer names or domains are runtime exceptions. Ordinary named sourcing contacts remain supported.

The regression reproduces flattened navigation and a separately headed office block for two unrelated seller identities, retains genuine accented names and sourcing roles, and checks workspace normalization. The original implementation fails; the repair passes. Full suites and release/customer acceptance are separate pending gates.

## Related acceptance

After reopening with the canonical-focus cache revision from PR #908, Ercon's Strategy remains current with the same saved signature and empty canonical/compatibility focus. Kitron's existing server research job is restored rather than duplicated and progresses from official sources to dossier research. This is authenticated evidence for those boundaries, not completion of Buyers, Messages or Delivery. No paid email/phone lookup or outreach has been sent.
