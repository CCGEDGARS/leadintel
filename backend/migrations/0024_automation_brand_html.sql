ALTER TABLE outreach_automation_sequences ADD COLUMN followup_html_body TEXT NOT NULL DEFAULT '';
ALTER TABLE outreach_automation_queue ADD COLUMN html_body TEXT NOT NULL DEFAULT '';
