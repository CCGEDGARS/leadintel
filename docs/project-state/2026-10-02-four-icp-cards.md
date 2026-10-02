# Four visible Strategy profiles

Strategy displays Core, Lookalike, Trigger-led and Opportunity-led cards without a collapsed matching section. Missing standard cards in saved workspaces are restored inactive; existing edits and activation remain preserved. Lookalike candidates remain visible without references and inactive. Existing reference and opportunity evidence requirements still disable activation and explain the required next action.

Regression coverage exercises the actual renderer with a saved Core-only workspace, checks four visible cards, disabled evidence-dependent controls and repeated rendering without duplication. Candidate/reload tests cover the four-profile set.

Desktop layout restores two equal columns (2×2 for four cards); widths at or below 700px use one column. Removed the obsolete Core-only block layout override.
