# Profile planning cards

The end of Profile presents Companies & Market Intelligence first, followed by Events & Meeting Invitations and Email Campaigns. All three use the same small category label, benefit headline, explanation, two capability blocks and right-side action. Event and campaign cards retain a separate Optional badge. On narrow screens the action moves below the text and explanation blocks stack.

The existing reference intelligence action remains unchanged. Event and email overview headings no longer toggle setup; dedicated Prepare event and Prepare campaign buttons open their existing forms. Back to overview closes the form without discarding entered values. Existing saved-event activation no longer automatically expands the Profile setup card; discovery and writing event panels retain their activation behavior. Event setup from the writer still uses its existing same-page dialog.

Research, company selection, importing, event evidence, writing, review, approval, delivery and workspace storage reuse the existing workflow. Opening a card performs no research and sends no messages. The existing explicit recipient shortcut can still open the linked email setup.

DOM regressions cover common card structure, first-card placement, optional badges, button-only opening, input preservation and the existing event setup dialog. Existing event and production smoke expectations were updated to the approved labels and explicit-opening behavior. Full customer CI, build and exact-SHA production proof are required before completion.
