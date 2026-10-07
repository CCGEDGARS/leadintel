# Inline sync review in Messages

The Review sync choices button only scrolled to controls in the fixed header. This gave no visible response in the Messages editor.

The button now reveals the existing server/local/recovery controls immediately below the warning. Canonical controls retain their IDs and handlers; neither version is selected automatically. Controls return to their original header locations when the conflict resolves. Generation stays blocked until resolution, preserving both workspace versions.

Regression coverage clicks the actual mounted Messages review button, verifies visible inline recovery actions and retained handlers, ensures no automatic choice, and checks resolution hides the panel. No outreach is sent.


Production verification: revision 77e0a63bde93bd3844826712ee13d490160d3939, CI 37645449505 success, exact manifest SHA and backend health pass, all 39 mandatory smoke checks pass, verdict PROVEN. Production JS returned 200 with show/restore helpers; signed-in page loaded message-workspace.css v20261007-v2 and retained Synced status. Mounted DOM tests cover the conflicted click path; the signed-in verification session had no active conflict, and no recovery option was selected. All 1872 tests and build passed.
