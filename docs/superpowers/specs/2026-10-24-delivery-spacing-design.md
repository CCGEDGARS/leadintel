# Delivery spacing and field consistency

User request: review five Delivery screenshots and improve design and space where needed.

Keep the existing light green visual system. Fix the unstyled sent-email history picker, add clear gaps between section descriptions and forms, separate classification from the reply action, enlarge the reply writing area, and give mailbox and blocked-contact panels consistent spacing. Labels must remain associated with their controls; long addresses must wrap without forcing the page wider. Narrow layouts stack fields and actions.

Approaches considered: a global spacing increase would enlarge unrelated pages and preserve the unstyled picker; replacing Delivery would risk established sending and CRM behavior. Choose scoped Delivery and suppression styles with small semantic markup improvements. This is an implementation choice under the user's request to make the changes.

Keep all existing control IDs, event bindings, approval gates, history selection and CRM records. No sending, suppression mutation, research or state migration is authorized by this design work. The attached CRM spec supplies the durable-history constraint; the astrology PDF is unrelated.

Acceptance: all five screenshot areas have consistent readable fields and visible separation; desktop and narrow layouts avoid clipping; customer tests/build and exact-SHA production proof pass; inspect the authenticated Delivery UI without sending or changing customer records.
