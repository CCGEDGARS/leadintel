# Required-action navigation

The app previously allowed unconfirmed targeting through Profile/Strategy and checked it only when company discovery started, redirecting to the top of Profile. Readiness (four completed answers) is distinct from explicit confirmation.

Profile approval, opening/approving Strategy, and forward module navigation now check targeting confirmation first. Missing answers focus the first missing targeting control; complete but unconfirmed answers focus Confirm targeting. Company discovery uses the same resolver before any provider work. Each resolver navigates, scrolls, focuses and inserts a persistent visible alert identifying the required action. Website/market navigation failures point to their specific controls; unapproved Profile points to its approval button; missing active customer profiles/signals point to their toggles. Stale research goes directly to Profile research.

Optional references, deeper research and monitoring remain optional. No automatic confirmation or invented answers are added. Changed essential answers still invalidate confirmation. Regressions cover actual focus selection, alert, approval blocking, handoff blocking and discovery provider gating.
