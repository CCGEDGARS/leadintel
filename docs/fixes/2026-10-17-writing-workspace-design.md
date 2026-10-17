# Writing workspace design — 17 October 2026

Implements the customer's approved design discussion and screenshots: one main working draft, a useful full-height assistant column on the right, grouped message controls and a compact Content Library.

## Customer behavior

- Desktop assistant: a 60/40 grid places the editor and conversation on the same row. The draft fills the left column; the right column holds adjustment actions, conversation, proposed responses and an instruction composer anchored at the bottom. The draft editor and conversation can scroll without a long outer modal scroll.
- Below 720 px, the assistant stacks the editor and conversation vertically. The main Messages page retains its existing stacked tablet layout below 900 px.
- Load script opens a temporary chooser above the same editor. Selecting a script closes the chooser and focuses the editable body. Explicit replacement confirmation, original protection and undo remain in place.
- Undo, Save as template and Use in Messages stay at the bottom of the editor. Use in Messages retains the existing save-to-Step-6 behavior; it neither approves nor sends outreach. Phone retains Save calling script.
- Content Library expands over the workspace, rather than pushing another page below it. The obscured workspace is inert while the library is open. Escape closes the library and returns focus to its launcher, preserving the instruction.
- The library has one Add book or file form targeting the first free slot, three compact capacity cards and small cover thumbnails. Existing sources retain replacement upload, activation, role, instructions, details, extraction review, analysis retry and deletion. New uploads remain inactive until explicitly activated. File validation, failed-upload retry and revision checks are unchanged.
- The main Messages toolbar groups Edit, Update message and Save. Add to flow retains its readiness gate. Body text is regular weight; recipient metadata is compact with the complete role available as a title. Writing Assistant naming and style/language labels are consistent.

## Validation

New mounted tests cover right-column placement, a single editor, chooser loading and focus, conversation scroll preservation, library overlay/Escape, and uploads to the first available slot. Actual CSS selectors are resolved at 1440, 850, 600 and 390 px for responsive regression checks. Existing source lifecycle, workspace isolation, proposal validation, cancellation, save/reopen and core-template tests remain required.

Release smoke expectations follow the approved UI changes rather than the retired labels and three repeated upload forms. Production acceptance also requires visual inspection of the actual assistant, library and Messages toolbar, along with exact-SHA release integrity evidence. No approved script content or sending permission changes are included.
