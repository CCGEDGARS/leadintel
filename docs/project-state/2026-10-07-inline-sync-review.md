# Inline sync review in Messages

The Review sync choices button only scrolled to controls in the fixed header. This gave no visible response in the Messages editor.

The button now reveals the existing server/local/recovery controls immediately below the warning. Canonical controls retain their IDs and handlers; neither version is selected automatically. Controls return to their original header locations when the conflict resolves. Generation stays blocked until resolution, preserving both workspace versions.

Regression coverage clicks the actual mounted Messages review button, verifies visible inline recovery actions and retained handlers, ensures no automatic choice, and checks resolution hides the panel. No outreach is sent.
