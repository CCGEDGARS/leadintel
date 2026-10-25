# Compact Font and Text size controls

User requested a design adjustment to the two typography dropdowns shown in the email toolbar. Apply the same shared styling in Writing Assistant.

Observed cause: the email page's generic details rule adds an 18px vertical margin to More formatting, while inherited form styling makes the expanded controls look uneven. Scope the formatting disclosure and dropdown styling to the shared rich editor so page-level details/form rules cannot change its spacing.

Use aligned labels, 36px dropdowns on desktop, 40px on small screens, restrained borders and green focus/hover states. Expanded formatting stays in a compact wrapping row. Keep native font/size choices, selection behavior, saved preferences and message content unchanged. Publish the stylesheet with a new cache key; verify both editor surfaces and release integrity.
