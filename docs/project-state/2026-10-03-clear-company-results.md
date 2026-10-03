# Clear company search results

Companies includes a confirmed Clear search results action. It resets discovery candidates, research checks, evidence results, search progress/history and unsaved Buyers selections. Search amount and strategy fingerprint remain. Saved CRM/pipeline records, profile, references, known company inputs, outreach and delivery history remain intact. Clearing is disabled while company discovery runs. Empty normalized discovery is saved through the workspace dirty event so it survives reload. New searches can populate fresh results normally.

Verification: full customer suite including clear/cancel/running guards and normalized reload preservation; static build and JavaScript syntax. Production smoke checks require the new handler and button in the served discovery script.
