# Saved message status banner

The application banner previously selected only applying/error/ready states and ignored the durable saved-draft predicate. It therefore asked users to save an already saved CRM message and inherited the amber progress styling.

The banner now uses the existing exact saved-draft and editor-state predicate. A saved matching style reads “<Style> message saved”; entering Edit shows editing guidance; applying a different style still asks for review/save. Ready and saved states have green success styling; pending and failed states retain their separate styling. This changes presentation only and never saves, generates, approves or sends content.

Regression coverage reproduces the old incorrect label, verifies saved → editing → cancel → saved, reopens the stored outreach snapshot, and checks the computed success colours. Full frontend tests and exact-SHA production proof remain required.
