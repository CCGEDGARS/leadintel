# Market research return action

Changed the Market Research footer action to “Proceed to profile review” to match its existing destination. The delegated click dispatches leadintel:review-research-profile; the shell runtime opens internal profile review (step 3 within the Profile journey). No navigation or approval behavior changed. Profile market research and company research structure checks pass; exact-SHA customer CI and production release integrity are required before reporting publication.
