# Release Integrity Final Review

Pre-merge self-review against the approved design:

- exact SHA is mandatory and validated;
- CI failure blocks before network verification;
- live manifest is cache-busted and must match exact SHA/ref/service;
- backend health is mandatory;
- every configured smoke check is mandatory;
- skipped mandatory gates cannot return PROVEN;
- CLI writes machine-readable proof and exits zero only for PROVEN;
- automatic workflow uses the completed Customer V2 CI head SHA, not github.sha;
- manual re-verification resolves CI evidence into success/failure and still runs the proof CLI;
- proof artifact uploads with `if: always()`;
- CI path filters cover verifier code, configuration, workflow, agent policy, and operational release policy;
- root AGENTS.md makes release integrity a repository-wide agent invariant;
- fixed status vocabulary forbids old-build substitution;
- LeadIntel URL-normalization and active-entry regressions remain part of production smoke coverage;
- generated proof is ignored by Git and contains no secret-bearing inputs.

Production is not considered proven until post-merge main CI and the Release Integrity workflow succeed for the same exact SHA.
