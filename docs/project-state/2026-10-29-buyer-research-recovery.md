# Buyer research execution and recovery

Root causes: automatic identity/contact search required Firecrawl before trying grounded sources; the known-identity manual branch returned before the legacy Google cross-check; partial query groups replayed completed requests on resume; Gemini discarded supported business citations outside official/LinkedIn domains; compound surnames generated only their last token in email hypotheses.

Automatic public research now falls back from missing, failed or empty Firecrawl searches to workspace grounded search, preserving actual source attribution. Credit/auth failures suppress repeated Firecrawl attempts within the run. No paid reveal APIs are used by this path. A failed search cannot become a successful empty result. Cancellation/context guards precede fallback.

Manual and automatic mandatory research run configured Gemini/Google cross-checks for contact gaps. Source absence is explicitly skipped; failed configured checks remain incomplete. Successful exact query receipts are reused on resume, including within partial groups; legacy LinkedIn reconciliation still requires a new search. Query source metadata survives normalization. Planned checks completed never means every possible source was exhausted.

Grounded third-party business citations require the exact name and employer plus professional context in cited support. They remain model summaries until underlying source extraction and the existing attribution checks pass. Private hosts and unsupported citations stay excluded. Compound surname variants remain unconfirmed hypotheses, preserving the original identity.

Validation: deterministic mocked provider, resume, cross-workspace/cancellation, namesake, phone callback and saved-flow tests. Broad local contact run encountered a sandbox EPERM timezone child-process test; remote CI is authoritative. No live paid Apollo lookup for Klas, no outreach and no account policy changes. Authenticated Chris/Klas contact outcomes remain unverified.
