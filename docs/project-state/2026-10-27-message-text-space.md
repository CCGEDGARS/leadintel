# Message text space — 27 October 2026

The owner requested more room for text and more space on both sides, with cropped screenshots of the Messages page edges.

The message body and LinkedIn editor now use the available composer width instead of the previous 84-character cap. Equal page gutters increase from 32px to 48px on wide screens; the editors gain 32px internal side padding. At 721–1150px the page uses 24px gutters and at 720px or below 16px gutters. Existing navigation widths, tablet stacking and saved message content are preserved.

The lazy-loading cache chain is versioned from index through discovery and outreach to the stylesheet. Production smoke checks require the actual spacing rules. Existing Messages layout, toolbar, template and release checks verify the change; authenticated customer visual acceptance remains separate.

Production verification found an upstream Conversations cache change with an older smoke assertion still requiring its October 23 stylesheet. Align the original entry check and synthetic shell fixture with the October 27 version already required by the workflow entry check. The spacing smoke passed; the release remains unproven until this conflicting assertion is corrected and exact-SHA verification passes. Future entry version changes must update every related smoke assertion and fixture.
