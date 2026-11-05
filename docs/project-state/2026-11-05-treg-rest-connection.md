# Treg REST credential check — 5 November 2026

The owner reported a saved paid-email lookup error: "Treg rejected the saved team token." This message is generated for HTTP 401/403 from the paid REST call. A successful chat-plugin balance check proves only the plugin's separate connection.

Settings previously verified the workspace token through MCP with Authorization: Bearer, while paid calls use REST with X-Treg-Token. Treg documents these authentication surfaces separately (https://treg.to/docs). Settings now checks GET /home with X-Treg-Token, requiring a resolved team and integer micro-USD balance. It stores only the team, USD balance, and authentication surface; no account details or tool list. Redirects fail closed. No paid lookup is dispatched.

Validation: 75 service-integration and paid-contact tests pass, including the authenticated Settings save/check HTTP path, rejecting invalid REST credentials, missing team/malformed balances, accepting zero balance without declaring it funded, and excluding provider-echoed secrets.

Acceptance limitation: no authenticated LeadIntel browser or transferable plugin credential is available in this session. The owner has been asked to reconnect only within LeadIntel Settings. No production credential has been changed, and no successful live paid lookup is claimed. This change repairs credential validation; it does not itself repair an expired/revoked saved token.
