# Messages workspace tools restoration

Customer reported the entire right-side tools block missing on Messages. Root cause: message-workspace.css explicitly set the global .utility-panel to display:none whenever Step 6 was active and changed the outer grid to two columns. The tools still existed but were inaccessible visually.

Remove the hiding rule and restore the desktop tools column containing AI Support, workspace status, Settings and background tasks. Reduce the centre preparation rail at medium desktop widths to retain room for the draft. At <=1060px use two outer columns with the existing tools layout below the content; <=980px keeps the stage's existing stacked navigation/content, and global utility breakpoints preserve phone access.

Regression: render the real premium and Messages styles against an active Messages DOM; assert the tools panel is visible and allocated a desktop column. 1,934 customer tests and the production build passed. Deployment and authenticated visual acceptance must be verified separately.
