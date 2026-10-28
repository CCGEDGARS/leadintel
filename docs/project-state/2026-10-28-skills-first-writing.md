# Skills-first Writing Assistant — 28 October 2026

User approved the existing two-column workbench with skills first, a scrollable list of all saved skills, up to three Ready/enabled selections and visible selected chips. Books are compact and collapsed until opened. One book can be selected for text discussion using the permitted current-work context. Discussion never applies changes. Voice remains outside this implementation.

Improve draft uses validated preview generation internally and then updates only the assistant working copy immediately. Existing text can be improved without typed instructions. Empty text needs a topic. Repeated actions use the latest working text, identical output adds no Undo revision, failures preserve the draft, and each applied revision retains Undo/provenance. Save, approval and send remain separate. Skill-writing excludes discussion books; book discussion excludes selected skills. Source-specific history and stale-scope guards remain enforced.

Validation: six new behavioral tests pass. The final targeted command spanning writing, book UI, production smoke fixtures, brand snapshot and release integrity core/policy/root reports 32 test files passed, zero failed. Step 6 checks report 57 files passed. Static build exits 0, Discovery guard passes and git diff --check is clean. No paid provider requests or recipient sends were used.

A broad 567-file customer run reported 560 passed and seven failures. Two failures were stale smoke/cache expectations and were corrected and rerun successfully. Remaining local limits involve sandbox child-process EPERM (contact timezone, CRM refresh, build-negative fixtures and profile startup) and a stalled release CI-path subprocess terminated after no progress. Full-suite success is not claimed. GitHub CI must establish the remote revision's result.

Publication: source branch/PR only until same-revision CI and production release proof have been established. No signed-in customer acceptance or production proof is established by these local checks.
