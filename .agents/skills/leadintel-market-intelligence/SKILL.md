---
name: leadintel-market-intelligence
description: Use when changing or evaluating LeadIntel market research, signal discovery, source selection, evidence validation, opportunity scoring, or research-depth behavior.
---

# LeadIntel Market Intelligence

## Core principle
LeadIntel research is evidence acquisition plus adaptive commercial reasoning, not a static batch of search queries. Preserve the state model: **Known → Planned → Researched → Verified**.

## Required research sequence
1. Start from confirmed Company Brain context: target market, priority offers, ICP, exclusions, active signals and commercial objective.
2. Define the research objective and what evidence would confirm or weaken it.
3. Build signal-specific query families and apply **source diversification** across relevant source classes.
4. Run a first pass, inspect what was actually found, then perform **adaptive follow-up** searches around promising companies, events, people, technologies or gaps.
5. Verify and extract the underlying evidence before treating a search result as a commercial signal.
6. Prefer **evidence triangulation** across independent source types for high-confidence opportunities.
7. Rank findings using relevance, **recency**, signal strength, source quality and **commercial fit** to the ICP/offers.
8. Deduplicate syndicated stories, suppress stale or generic content, enforce exclusions, and expose confidence/evidence gaps.

## Research depth
| Mode | Required behavior |
| --- | --- |
| **Market Scan** | Fast validation of the strongest active signals. Automatic source choice, high recency bias, limited first-pass research, early stop when enough credible evidence exists. |
| **Market Research** | Broader signal families plus live source discovery. Perform company-level adaptive follow-up and verify the strongest findings. |
| **Market Intelligence** | Widest source intelligence map, iterative follow-up, competitor/pattern/context analysis, stronger triangulation and explicit intelligence gaps. |

Do not differentiate the modes only by raw query count. They must differ in reasoning depth, source breadth, follow-up behavior and verification standard.

## Tool roles
- **OpenAI**: web discovery/search where enabled, research planning, query decomposition, adaptive follow-up and commercial reasoning.
- **Gemini**: alternative reasoning, synthesis, cross-checking, translation and verification support. Never claim Gemini searched the web unless an actual grounded/web-search path was used.
- **Firecrawl**: public-page search, extraction and evidence verification. Preserve source URL and extracted evidence.
- **Scrapling**: approved extraction fallback for pages Firecrawl cannot reliably handle, but only when a runtime Scrapling adapter is actually installed. If it is absent, report the gap; never pretend it ran.
- **Apollo**: enrich already-qualified companies and decision makers after the evidence/fit gate. Use verified business contact data, role fit and available LinkedIn URLs; do not use Apollo as a substitute for market evidence.
- **LinkedIn**: use authorized/sanctioned access only. LinkedIn profile URLs returned by Apollo and publicly accessible LinkedIn evidence may support identity or role verification. Never scrape restricted logged-in LinkedIn pages or imply direct LinkedIn access when none exists.

## Source diversification
Choose sources for the signal being tested rather than hard-coding generic sites by country. Relevant classes can include company websites, company newsrooms, business news, job boards, registries, industry associations, funding/investment sources, leadership announcements, technology/CRM/AI signals, specialist publications and user-added sources.

## Evidence and scoring rules
- Never show a market opportunity score before research has produced evidence.
- Every material opportunity should retain the supporting URL, source type, date/recency signal and claim it supports.
- Cap confidence when evidence coverage is weak or relies on one source.
- Tenders stay excluded unless the tender signal is explicitly active or the user enables them.
- A company should pass evidence + ICP/commercial-fit gates before Apollo contact enrichment is triggered.
- Prefer recent company-specific evidence over generic SEO pages, listicles or commentary.

## Stop conditions
Stop when the selected mode's evidence threshold is met, incremental searches stop adding materially new evidence, or remaining gaps require unavailable/restricted data. Report the gap instead of filling it with inference.

## Common mistakes
Avoid one giant query, repetitive near-duplicate searches, generic country source defaults, single-source certainty, contact enrichment before company qualification, stale-event scoring, fabricated URLs, and claims that a provider/tool was used when no verified runtime path exists.
