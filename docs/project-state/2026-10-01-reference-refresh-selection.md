# Reference refresh selection recovery

Customer screenshots confirm successful refreshed analysis: 5 references, 25 pages and new analysis timestamp. They expose an empty disabled checkbox alongside Active in company discovery.

Root cause: refresh activates evidenced row IDs but discards segment selection IDs before publishing. Discovery consumes the published rows correctly, while UI checks only segment IDs.

Fix: refreshed publication records eligible segments only when every constituent row has matching evidence; existing row-based publications display the selection based on full published row membership. Pending drafts and partially supported groups are not shown as selected. Regression covers legacy refresh state, partial membership, pending edits and new publication IDs. No new customer analysis or reset is required.

Research quality remains separate: screenshots show incomplete manufacturing evidence for some references. Passing state/UI tests does not prove Swedish prospect quality.
