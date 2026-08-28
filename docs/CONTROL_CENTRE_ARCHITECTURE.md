# Lead Intel V2 — Control Centre Architecture

Status: Approved product direction  
Owner: Edgars Untāls / Coaching & Consulting Group  
Decision date: 2026-07-16

## Core product requirement

Lead Intel V2 will be managed from one main interface. Research, analysis,
scoring, enrichment, storage, email delivery, and approved outreach will run in
the background. Normal operation and client tailoring must not require editing
the Make scenario.

## Control-centre responsibilities

The interface will allow an authorised user to manage:

- business and workspace profile;
- offers, priorities, and positioning;
- ideal-client criteria and decision-maker roles;
- enabled research sources and search queries;
- scoring weights, confidence requirements, and qualification thresholds;
- schedule, result limits, and API budgets;
- top-five app results and top-three email brief rules;
- contact-enrichment requirements and verified-email preference;
- outreach templates, language, tone, and approval rules;
- integration status, run history, costs, and errors.

## Reusable company workspaces

The system will support separate workspaces for Edgars and future clients.
Creating a new workspace will not require rebuilding the automation. Each
workspace will have its own:

- Workspace ID;
- company profile, website, market, and location;
- offers and ideal-client definition;
- sources, queries, scoring rules, and schedules;
- leads, contacts, run history, and reporting;
- email/storage connections and permissions.

The remaining automation must therefore be designed around `workspace_id`
rather than hard-coded only for Coaching & Consulting Group.

## System roles

- Lead Intel interface: control centre and approval workspace.
- Secure backend/database: workspace settings, leads, contacts, permissions,
  and run state.
- Make: background orchestration.
- Firecrawl: web discovery and extraction.
- OpenAI: analysis, evidence separation, scoring, and recommendations.
- Apollo: approved decision-maker enrichment only.
- Google Sheets/Drive: operational reporting and backup.
- Gmail: daily brief and human-approved outreach.

## Security and privacy requirements

- Never expose API keys, credentials, or private contacts in the public
  browser frontend.
- Store credentials in secure provider connections or a backend secret vault.
- Keep each client's settings, leads, contacts, and permissions separated.
- Require human approval before sending outreach.
- Keep the public interface free of private decision-maker contact data.

## Delivery sequence

1. Complete and verify the single-workspace discovery pipeline.
2. Connect the interface to persistent settings and lead data.
3. Replace hard-coded automation settings with workspace-driven settings.
4. Add workspace switching and a guided new-client setup flow.
5. Add role-based access, secure credentials, monitoring, and approvals.
6. Validate a second-company setup without duplicating the Make scenario.

## Definition of done

An authorised user can create or select a company workspace, adjust the full
research and qualification process from the interface, activate or pause it,
review the resulting leads, approve outreach, and monitor runs without opening
Make for normal operations.
