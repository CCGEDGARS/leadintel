# Compact Strategy research

The Strategy page repeated the selected priority market and seller-profile commercial focus/customer description inside profile-only opportunity cards. Research UX decorators then added further context and warnings to explain that these were not research results. An additional empty report box repeated the idle research status.

Strategy now has one optional Market research header, status, and the existing research-workbench action. Actual opportunities, market conditions and saved reports sit inside a native, initially collapsed details disclosure. Profile-only opportunities are omitted from presentation, without changing their saved active state or downstream targeting. Evidence-backed opportunity indexes and activation controls remain intact. Empty report messaging is suppressed only in the compact Strategy host; the research workbench retains its existing empty state. The workbench action continues to use the selected profile markets.

Regression coverage exercises idle/running/error/researched states, mixed opportunity indexes, evidence links, disclosure close/reopen, state reload, saved-report visibility and report deletion. Asset query versions ensure updated app, report renderer and styles are requested.

Release verification is tracked separately using the exact release SHA and release-integrity proof. The tests do not establish customer-session acceptance.
