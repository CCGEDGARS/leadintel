# Optional email verification

The required Step 1 checkbox and its save-success wording contradicted the agreed default: public research can confirm a named buyer's company email; Apollo and Hunter are optional customer choices.

Root cause: the checkbox was display-only, but standalone automatic policies and workflow configurations with buyer roles and no confirmation level still fell back to provider verification. The shared browser policy also defaulted missing choices to provider verification.

Remove the control and unused styling. Missing choices now use public-source confirmation in backend configuration, policy loading and shared contact acceptance; service settings use the same default. Preserve explicitly selected provider requirements and optional Hunter checks. Policy read errors remain conservative. Existing official-domain, person/email attribution, source freshness, workspace isolation, suppression, approval and delivery activation gates remain enforced. Public confirmation does not claim mailbox deliverability.

Regression coverage checks standalone automatic delivery with a real persisted public confirmation and no paid request, explicit provider configuration save/reload, unavailable policy holding delivery, omitted shared-policy choices, guessed emails and removal of both the control and required-verification save message. The production smoke gate checks the removed text and retained save footer.
