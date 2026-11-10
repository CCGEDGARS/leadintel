# Workspace saves through the first-party hosting proxy

## Observed failure and authoritative boundary

The owner explicitly authorized transferring private workspace data to Firecrawl for the Ercon live review. Authenticated access then worked without a new login. The reviewed Profile and three active signals were acknowledged by cloud persistence. Profile approval refreshed the generated ICP offers, roles and exclusions from the owner's current inputs, as intended. Review used official company pages and user-confirmed context; unrelated external companies sharing the name were not used as corroboration.

A bounded Quick Overview subsequently completed its four searches locally. The new evidence pushed the combined workspace transfer over the hosting proxy limit. The actual first-party `PUT /api/customer/state` returned HTTP 413 with `{error:{code:"413",message:"Request Entity Too Large"}}`. The bridge converted this object to `[object Object]`, Strategy approval correctly failed closed, and the button retained its Saving caption. The failed transfer is not a storage quota rejection or a research-provider failure. No monitoring schedule was enabled.

Root cause: `workspace-records-v1` advertises an 8 MiB backend transfer allowance. The shared codec returned complete uncompressed payloads below that allowance before considering compression. This bypassed the lossless codec at the smaller first-party hosting boundary (4.5 MB request bodies). Backend capacity and the end-to-end wire allowance are separate.

## Fix and preservation contract

- Keep the negotiated 8 MiB backend record capability and existing compression format/readers. No schema migration, storage allowance change, authentication change or customer-specific routing.
- For record-capable saves, prefer negotiated lossless compression for large payloads. Limit the encoded payload to 4 MiB, leaving room for the version/schema JSON envelope below the hosting cap.
- Never fall through to legacy evidence trimming for record-capable workspaces. If lossless encoding cannot fit, reject before sending and retain the local work. This is an explicit bounded transfer failure, not successful persistence. Larger incompressible workspaces require a separately designed segmented-transfer path; do not bypass the proxy or weaken credentials/limits.
- Normalize structured and string workspace-save errors into readable messages with HTTP status, stable code, request path and persistence phase. A 413 explains the transfer limit and preserved local edits.
- Failed Strategy persistence clears the Saving caption and offers a deliberate retry. It cannot approve, navigate, enable monitoring or start company research.
- Refresh cache versions for the initial codec, imported codec, background worker, worker import, persistence owner, bridge and app. Production smoke checks cover both active and background encoding paths.

Existing field-specific ingestion bounds remain unchanged. Transport round-trip tests use records within those field bounds rather than relying on undeclared fields or oversized individual document excerpts. A fixture initially used an unsupported company note, then an individually oversized document; those were corrected to a retained source archive, without weakening the exact-quote preservation assertions.

## Acceptance and limits

Failure-first tests reproduced the proxy-sized raw payload, unbounded incompressible transfer, structured-error coercion and stuck approval caption. The browser regression seeds more than 4.5 MB of retained source records, enforces the production proxy boundary ahead of the real authenticated HTTP/SQL routes, and verifies approval, monitoring, browser-independent scheduling, pause and fresh reopen. Both browser and server must retain every archived source URL and exact quote, with zero proxy rejections. A separate pending-Profile case preserves explicit approval behavior.

Exact-SHA release proof and actual customer acceptance remain separate gates. The live acceptance must repeat the unfinished bounded research after the fix, obtain acknowledged Strategy persistence, return to the actual monitoring wrapper, run the entered website through the configured provider, verify persisted history and reopen, and explicitly enable only the intended schedule. Earlier local research completion and controlled alerts do not establish a real customer run or real alert.

No paid contact confirmation, outreach, destructive cleanup or credential/session export is part of this repair. Saved customer research is preserved. Rollback readers already support the existing lossless format; rollback does not delete or rewrite saved evidence.
