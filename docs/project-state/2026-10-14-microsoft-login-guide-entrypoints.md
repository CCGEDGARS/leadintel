# Microsoft sign-in guide entry points

Production ai-settings.js was byte-identical to the intended complete Microsoft guide (v4). The exact affected customer tab was unavailable. A separate confirmed gap was found: the page-header Microsoft sign-in listener called the low-level OAuth function directly, bypassing the updated Settings help popup. Thus a user starting from the header could never see the new instructions.

The header now calls the same Microsoft sign-in guide as Settings. The Settings module exposes a small guide entry point which opens the drawer and action-specific popup. Only Continue to Microsoft starts OAuth. If the guide module is not ready, a loading message holds the action; it never bypasses the guide. Drawer autofocus respects the open popup. Existing account/context race protection and Cancel behavior remain unchanged.

Both the Settings module/stylesheet version and server bridge entry URL are refreshed. Browser DOM regressions cover header guide visibility, complete recovery links, focus, no premature navigation, navigation only after Continue and module-loading hold. Full customer tests, static build and production smoke checks verify the changed assets.

This addresses instruction visibility and entry-point consistency. These tests do not authenticate a real Microsoft customer or prove their tenant approval/app-registration state. The guide continues to distinguish user recovery steps from company approval and application-registration errors.
