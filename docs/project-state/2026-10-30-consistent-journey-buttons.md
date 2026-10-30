# Consistent journey buttons

All journey footer actions use the wide centred appearance shown in Setup and Strategy: up to 640px wide, 72px minimum height, 10px corners, 18px text and the same dark background. At mobile widths up to 680px, each fills its container with 58px minimum height and 16px text. This also applies to the Writing Assistant return button and the final Delivery workflow action.

Previously, individual Buyers, Messages and Companies styles overrode the older shared stage styles. One central visual contract in styles.css now governs the explicit footer button IDs and footer containers. Hidden controls stay hidden, disabled controls stay readable, and keyboard focus remains visible. The CSS URL is versioned for this change. No transition handlers, saved data, mandatory prerequisites or sending approvals were changed.

Validation uses Chromium at 1440px, 390px and 320px, with all feature styles loaded after the shared CSS to exercise the cascade. It checks equal dimensions, centring, typography, colour, viewport containment, disabled readability and hidden controls. Workflow regression tests verify existing guided prerequisite and save/handoff behavior. These are isolated fixtures rather than authenticated customer acceptance.
