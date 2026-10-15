# LeadIntel feature-card standard

Use `.planning-card` for optional feature entry points throughout LeadIntel. Existing Profile planning cards and Strategy website monitoring share these styles.

## Closed overview

Show one category label in `.planning-card-label .eyebrow`, an `Optional` badge when applicable, one purpose-led `h3`, one short `.reference-value-lead` paragraph, and one `.planning-card-action` button. Keep detailed explanations, setup controls, examples, research modes and workflow notes inside the opened feature view. The card body is not a second activation target.

Desktop uses one flexible text column and one 260–320 px action column, centered vertically. A shared minimum content height aligns compact cards without imposing fixed heights on long or translated text. At 900 px and below, stack the action under the text, allow button labels to wrap, and remove the minimum content height.

Use the same typography, border, background, padding, button dimensions and focus styles. Preserve status indicators where they communicate actual saved activation state, as with monitoring. Do not impose identical words or fixed heights across features.

## Opened feature view

Keep existing useful guidance accessible after opening. Reference Companies already explains the 3–5 example recommendation, supported inputs and the distinction between ideal examples and actual client proof. Market Research already owns research-depth choices, evidence and how findings guide Strategy.

Use an explicit close/back control. Closing and reopening must preserve saved inputs and activation state. A collapse action never turns a feature off. For forms with destructive unsaved changes, offer Save, Discard and Keep editing; retain existing automatic saving and draft-preserving flows where they already work.

## This change

The Companies & Market Intelligence overview now matches Events & Meeting Invitations and Email Campaigns: category + Optional badge + headline + one sentence + right-side button. The repeated reference/research blocks and workflow note are removed from the overview; their explanations and full controls remain available in the existing window. Research and activation behavior is unchanged.

Verification covers compact card structure, consistent desktop styles, reuse outside Profile/Strategy, existing event/campaign open-close behavior, reference guidance in the window, saved reference preservation and retained research inputs after closing/reopening. Production still requires exact-SHA CI and release-integrity proof.


## Equal overview size and information density

Companies & Market Intelligence, Events & Meeting Invitations, Email Campaigns and Website monitoring use the same desktop rows: category/badge, headline, short description and status space. Descriptions use 18–24 English words. Status space is reserved without inventing status messages for features that do not have one. Monitoring keeps its real status outside; its longer saved configuration summary appears inside the opened settings.

Rows use minimum sizes and grow for longer text; never clip, truncate or line-clamp instructions. Narrow desktop layouts reserve two headline lines and three description lines. Mobile removes the reserved row sizes and stacks naturally. The closed card does not expose duplicate explanations or saved configuration details.

The older monitoring screenshot was checked against the production HTML: the server already served the newer markup. A page left open on an earlier release can retain that earlier document. Keep the existing save-aware Update now mechanism and provide a release-specific URL after publication; do not clear customer storage or force reload unsaved forms.
