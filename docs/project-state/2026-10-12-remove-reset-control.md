# Remove message Reset control

User approved removing Reset because Update message rebuilds the selected template. The editor now shows Edit, Save, Add to templates and Set as default; Update message remains beside Add to flow. The internal restore node stays permanently hidden so existing bindings and recovery logic remain intact. Stored original snapshots and recovery history are unchanged. This does not affect workspace reset or subject-option reset actions.

Existing control-layout regression updated; editor/control tests and static build verify the change. Loader cache invalidation covers the editor through the HTML entry.
