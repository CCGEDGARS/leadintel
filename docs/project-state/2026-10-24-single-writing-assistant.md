# Messages: one Writing Assistant

Edgars approved removing the AI Generated choice because Writing Assistant covers original creation and editing. Visible email styles remain Professional, NLP, Friendly and Brutal Honesty; channel-specific approved styles retain their existing rules. Duplicate AI-original style buttons are also omitted from phone and InMail pickers.

Internal `original` modes and saved records remain supported. Rendering and reopening do not select a different template or replace an existing subject/body. Legacy generator contracts remain covered through internal mode selection; tests must not require retired buttons. AI history and CRM snapshots remain recoverable. The former Generate another controls stay hidden.

Draft length lives in Writing Assistant. Short 80–120, Standard 120–200 and Detailed 200–300 are preferences for an explicit email/general draft preview. They do not affect advice, quick adjustments, phone/LinkedIn limits, canonical masters or approval. Changing the preference performs no generation and does not invalidate the saved message. The existing workspace `aiLength` preference is retained.

Length travels separately as `preferredLength`, validated by the server and included as bounded model preferences only for the correct channel and preview intent. The complete 4,000-character user instruction remains unchanged. Do not append synthetic instructions into that bounded user field: review reproduced a valid 3,900-character input being rejected by the earlier approach. Regression tests exercise the full 4,000-character UI/controller request and backend preference contract.

Explicit preview, Apply, Save and sending remain separate. No live outreach or follow-up activation is part of testing. Release requires exact-SHA CI, backend deployment when changed, matching manifest, health and all configured smoke checks. UI presence and authenticated observations are verified separately from synthetic save/reload and CRM tests.
