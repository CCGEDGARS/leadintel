# Supplied company domains and Nordic names

## Observation and reproduction

The 16:30 recording shows Find contacts entering website verification and then stopping: the extracted company has an empty official-website field and remains unresolved. This is a verification failure, not an ignored button click. The visible name/domain combination uses Nordic spelling (BØGE STÅL / bogestaal).

A controlled reproduction confirmed that the domain matcher removed `ø` rather than matching common domain spellings, and lost the `å` → `aa` spelling. Fresh extraction therefore dropped the supplied homepage. Saved rows with an empty website searched externally, then excluded every result on the original source domain. The recording does not expose the actual provider responses or prove credit exhaustion. A direct public-page read during diagnosis returned HTTP 403, so no claim about the live page's current title or content is made.

## Change and bounds

- Domain matching recognizes common Nordic/European spellings while retaining the company-name evidence, page-title, homepage, directory and blocked-host checks. Empty ASCII tokens cannot match arbitrary domains.
- A saved blank website first checks a plausible original company domain. Only a successful identity check fills the website and identity URL. Otherwise the existing bounded search can continue. The original source is eligible for verification; a listing publisher is never accepted merely because it was supplied.
- The supplied-domain check shares the existing three-distinct-homepage limit. A successful check avoids an external discovery search. Failed reads preserve the provider reason; a failed supplied-domain read does not launch another search.
- Existing browser loaders receive the versioned scanner. No schema migration, profile targeting, contact permissions or delivery changes.

## Acceptance

Focused tests reproduce the original rejection, cover multiple name/domain spellings, directory rejection, bounded/deduplicated checks, provider failures, cancellation and workspace changes. The authenticated HTTP/SQLite/Chromium journey opens a legacy unresolved scan, verifies the supplied domain, saves the exact company to CRM, starts native contact research, advances it through the registered scheduler, and reopens on mobile without repeating verification. It also scans afresh through controlled Firecrawl/AI responses and verifies retention of the supplied URL. No paid contact calls or real customer research credits are used.

This is controlled product evidence. Private workspace outcomes and the exact production release proof remain separate acceptance records.
