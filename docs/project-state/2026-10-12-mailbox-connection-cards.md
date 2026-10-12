# Mailbox connection cards

The Gmail Settings card rendered status and external account links but omitted
any mailbox authorization action. Microsoft 365 had its authorization control
but also displayed redundant Create account / Open provider links.

Both Settings cards now focus on connecting an existing customer mailbox.
External account links are omitted only for these two mailbox cards; API-provider,
identity and other setup links retain their existing purpose. Gmail connects
through the existing authenticated `connectGmail` bridge/OAuth path. Microsoft
365 keeps its existing connection path. Connected cards show the mailbox email
and owner-only Disconnect. Disconnection preserves workspace sign-in and uses
the existing backend operation. Requests completing after a workspace switch
cannot update the next workspace's controls.

Gmail status now retains the configured/connected/role/email fields needed by
its actions. Mailbox status events update the cards and active-tools summary.
Unavailable backend configuration leaves a visible disabled Connect button
alongside the error explanation; signed-out users must sign in first. Both
action rows share button sizing. Cache versions and production smoke checks
cover the new controls.

Behavioral regression tests mount the actual Settings module, exercise both
Connect and Disconnect actions, close/reopen, email display, owner restrictions
and unavailable configuration. Existing provider-link and privacy coverage
checks that only mailbox links were removed. These tests do not complete an
external user's OAuth consent or send email.
