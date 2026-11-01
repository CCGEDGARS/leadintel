# Optional event website preparation

Goal: Extend the existing optional event card without changing the main journey.
Architecture: Reuse saved events, shared recipient selector, company research, buyer research and delivery gates. Add public website extraction with editable suggestions and retained source evidence. Default only new UI events to visitor; retain legacy saved roles.

- Add conservative website suggestion parsing: title, explicit ISO dates, participant links; preserve historical dates as evidence rather than activating past events.
- Add an Analyze website action using the existing Firecrawl proxy. Never overwrite populated fields. Guard workspace, selection and in-flight edits. Display extraction gaps and retain a source receipt in the saved event.
- Clarify event participants / countrywide business partners / both. Include official website in participant research and remove hardcoded manufacturing bias from country research.
- Verify parsing, saved evidence, scope, UI regressions and static build. No sending or automatic campaign activation.
