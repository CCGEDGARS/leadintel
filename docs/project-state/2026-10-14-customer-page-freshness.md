# Customer page freshness

The served production HTML and settings module already contained the revised setup controls. HTTP headers required revalidation. However, loaded tabs retained their original JavaScript indefinitely, and no page code compared its loaded build with the server release manifest. This supports a stale open-tab explanation; no authenticated customer tab was available to establish their exact browser state.

The static build now stamps the customer HTML with the same commit as release.json. A small deferred page guard checks the same-origin manifest without cache on startup, focus, pageshow (including browser back/forward restoration), Settings opening, visibility return and every five minutes while visible. Different valid releases show an Update available notice. Unchanged, invalid, offline or duplicate in-flight checks do not navigate.

Update now uses existing workspace persistence to save dirty work before navigating to the same page with a release query parameter. It retains query parameters and fragment. Missing persistence, failed saves and edits that remain dirty hold navigation. The guard never clears browser storage, switches accounts, resets settings or sends email. Tabs loaded before the guard existed must reopen the fresh link once; code cannot be injected remotely into an already-loaded tab.

Regression tests exercise detection without forced reload or draft loss, cache-busted manifest retrieval, save-before-refresh, failed saves and new edits, unchanged/invalid/offline responses, duplicate requests and preserved URL context. Build validation checks the generated HTML stamp against release.json. Production smoke checks cover the guard and the revised settings.
