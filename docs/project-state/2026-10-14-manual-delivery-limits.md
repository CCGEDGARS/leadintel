# Automatic-only daily limit in Setup

Step 1 previously displayed and validated automatic sending limits while Manual mode was selected. The agreed behavior is to show the daily limit only for Automatic, retaining the last saved automatic limit when switching modes.

The daily limit group now hides immediately in Manual, including the custom value. Its explicit hidden CSS rule overrides the flex layout. The Save settings button remains visible. Saving Manual preserves both existing workspace and mailbox limits and skips hidden draft validation. Automatic mode still validates and saves its limit, and selecting it in Setup does not activate sending. No backend quota or provider limit is removed.

Browser DOM regressions cover initial visibility, custom-value restoration, repeated mode switches, manual save/reload with an invalid hidden draft, preservation of distinct saved limits, and automatic validation/save without activation. The production smoke gate verifies the conditional control and save path; cache versions refresh the module, stylesheet and loader boundaries.
