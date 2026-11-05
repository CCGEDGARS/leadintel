# Paid response profile isolation

Observed customer outcome: Emma's manual paid email attempt reports CONTACT_IDENTITY_MISMATCH after connection succeeds. The screenshot does not contain the returned fields, so its exact causal mismatch remains unestablished. No authenticated current response or new customer export was accessed.

Controlled reproduction: a correctly bound, independently verified contact plus optional enrichment profile for an unrelated employer causes the client to discard the verified email. The regression fails before the change. Optional profile attribution is now isolated: if removing only that profile yields valid research identity, retain sibling outcomes and mark the profile conflict. Never relax buyer ID, name, domain, title, employer or selected LinkedIn identity envelope checks. Pass the sanitized data to the acceptance adapter and saved outcome, so the next boundary cannot reintroduce the rejected profile.

Wrong research envelope tests cover all six identity fields. Existing wrong-contact and workspace/race tests remain passing. Contact mismatch errors now name fields rather than repeat an opaque message, without exposing returned values or credentials. No paid request, contact overwrite or outbound message was executed for this work.

Customer acceptance remains open: this reproduces and fixes one real rejection path, not proof that Emma has a verified email. Robert's dossier hold is separate.
