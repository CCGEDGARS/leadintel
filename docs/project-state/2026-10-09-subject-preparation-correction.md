# Subject and preparation status correction

The customer screenshot showed a Malmberget selected event with a Gällivare subject, an unavailable NLP project subject, and a failed request still displaying Preparing.

Subject extraction previously concatenated metadata before event evidence. It now prefers the reviewed event summary/excerpt over headline location metadata. Compact offers select an entire supplied capability from the actual offering list, without importing a reference customer or assuming steel from metalworking. Approved subject patterns and original bodies remain unchanged.

The preparation failure handler now replaces busy text with the returned error. Provider or validation failures preserve the current draft. This fixes misleading status; it does not establish why this customer's authenticated API request failed.

Regression coverage includes different project names, full offering lists, API failure display, unchanged drafts, and existing save/reload and original protections. Production integrity proves released assets and configured health/smokes, not successful authenticated field generation in the customer's workspace.
