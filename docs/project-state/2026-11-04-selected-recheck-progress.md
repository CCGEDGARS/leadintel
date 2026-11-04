# Selected-contact Recheck progress

Owner observed all four cards showing research after pressing one Recheck. The durable request already carries selected person IDs and the backend narrows the candidate roster, but card controls read the legacy publicContactPromises map; durable jobs bypass that map. Missing legacy scope therefore made every card busy.

Persist selected IDs on the durable job reference, including GET restoration. Card activity and action readiness use that scope. Only the selected card says Rechecking and shows current activity, elapsed request time and a historical estimate when at least five samples exist. Unknown estimates are explicit. Other saved contacts retain independent readiness; another Recheck waits for the existing company job. Hide previous-run error captions during a new active run.

Tighten selected scope reuse from subset containment to exact set equality: one-person Recheck must not attach to a broader selected-person job. Existing server scope filtering and free-only manual research remain intact. No provider execution claims or invented duration guarantees.

Validation: 860 buyer tests pass locally, including durable job restoration, exact selected request, no paid dispatch, selected-card progress, ready controls on other cards, timing/queue state and existing research boundaries. CI verifies the exact combined revision.
