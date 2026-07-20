# LeadIntel snapshot endpoint

This Google Apps Script exposes a read-only, contact-free snapshot of qualified
rows from `Make Raw Findings`. Deploy it as a web app that executes as the owner
and is accessible to anyone with the URL. LeadIntel loads it through JSONP to
avoid cross-origin fetch issues.

The endpoint deliberately excludes API keys, webhook URLs, phone numbers,
personal or unverified emails, and rejected findings. A business email is
published only when its status is exactly `Verified`. Reading the dashboard
does not consume Make, Firecrawl, OpenAI, or Apollo credits.
