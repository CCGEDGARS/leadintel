# Paid contact hold and retry corrections

Chris screenshot: a generic additional-services reservation failure was labelled Treg error while the phone channel independently claimed no number in completed searches. Klas screenshot: retained token rejection from an earlier saved attempt did not describe the state of a newly connected token. Authenticated provider outcomes are not available in this task.

Fixes: exact app daily/monthly/company quota messages and recovery advice after an atomic reservation denial; no provider execution claimed. Preserve Treg retry reservation rather than deleting it then skipping re-insertion. Confirm phone requests phone only, with explicit approval and existing consent gates. Scoped failure metadata survives workspace/CRM normalization. Legacy paid holds mark channels incomplete; saved token failures retain timestamps and explain reconnect/retry without claiming the new connection was tested. Newer failures are no longer hidden behind older contactData. Saved emails and numbers remain intact.

Validation uses synthetic contacts and mocked providers only. No paid lookup for Chris or Klas, no outreach, no policy or credential changes. Existing limits are preserved.
