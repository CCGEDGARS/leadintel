# Message channels and LinkedIn core styles

Messages now has persistent Email and LinkedIn shortcuts in the left sidebar, with the confirmed active channel highlighted. Each shortcut reopens that workspace's saved confirmed recipient through the existing CRM/identity gates. Missing or invalid confirmation returns to Buyers. Existing current selections migrate into per-channel history when switching. Buyer and channel draft caches remain separate.

LinkedIn supports protected Professional, NLP (curiosity), Friendly, and editable AI Generated approaches. Core LinkedIn patterns are short, body-only adaptations, have no subject choices, and request a 30-minute Zoom meeting using the approved Calendly URL. Approved seller/buyer evidence and supported business benefits remain mandatory. Brutal Honesty stays email-only. Users can copy core wording or save generated drafts into three independent personal LinkedIn template slots without editing masters. Sending remains manual inside LinkedIn.

Language labels are English-only, including saved tabs and selected targets. Search accepts native and English language names; translation capabilities and independent language copies are retained.

Navigation request ownership protects newer selections from late failures and repeated identical clicks. Async CRM lookup/recovery checks authentication, workspace, synchronization and request ownership before committing. Both failed concurrent switches restore the last stable selection. Pending CRM recovery does not save or display a new handoff until gates pass.

Validation: 1,898 customer tests pass; static build passes; independent review cleared all Critical and Important findings. Regression coverage includes all core modes and storage, protected master copies, mounted LinkedIn controls, native-name search aliases, active sidebar selection, legacy channel history, repeated/failed switches, late newer selections, CRM auth/conflict changes, and existing buyer draft/CRM persistence. No outreach sent.

Production release: PR456 and the capture-guard integration correction PR457 merged. Exact production SHA 4b2c7305fc153632cb844879c4c54f8f560f0f8a, Customer V2 CI 37665659133 success, release verifier PROVEN with all 39 mandatory checks and matching manifest/backend health. Proof retained in 2026-10-07-linkedin-styles-final-production-proof.json.

Live signed-in verification: existing confirmed Joakim LinkedIn draft restored; sidebar Email then LinkedIn each restored separate unchanged drafts, active LinkedIn aria-current=page. Professional/NLP/Friendly/AI Generated and existing personal LinkedIn slot visible, Brutal Honesty absent; body-only protected preview read-only. English language suggestions and native Latviešu search alias verified. Original user editor was not reloaded. No messages sent. Screenshot leadintel-linkedin-styles-20261007.jpg retained.

Integration correction: document-level website activation capture guard treated nested channel buttons as direct stage entry and silently wrote to hidden Setup status. A narrow exemption for Messages channel actions lets their independent auth/workspace/sync/CRM gates run. New regression uses the actual document capture guard plus sidebar handler; direct stage entry remains blocked with stale activation. Full suite 1,898/1,898 and build pass; independent review confirmed exemption scope.
