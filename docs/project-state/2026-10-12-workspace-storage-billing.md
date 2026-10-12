# Workspace storage — 12 October 2026

## Where the earlier work ended

Browser compression/account archives/IndexedDB recovery were completed and verified on main4031181cde8d03d05bb7b4b12ed4acf73758eae6. No commercial storage UI, usage entitlement or Stripe route existed. This change adds that separate layer and preserves the recovery work.

## Policy and implemented behavior

One shared allowance per authenticated workspace. Included:100 MB logical stored CRM/workspace content and1 GB files. Storage Plus:500 MB and10 GB. All sizes decimal. Yellow at80%, red when full, rejected growth or confirmed storage payment failure. Connection failures are yellow. Existing records stay readable after expiration/cancellation/full allowance; reductions/deletions release counted space. Private file accounting includes originals and derivatives, not only document filenames. Browser recovery capacity and the512 KB per-state wire limit are independent and cannot be sold as storage upgrades.

43 tables are metered through transaction triggers, including project/source/run children and binary brand chunks. Existing rows are backfilled before installing growth limits. Failed multi-statement saves roll back counters/data together; parent-child deletion releases both. Private R2 writes reserve before upload, serialize replacement and release only after confirmed removal. Unknown legacy sizes are measured through R2 head before being called exact. Failed/ambiguous operations remain counted until bounded reconciliation.

Owner-only Stripe hosted subscription Checkout/portal. Server-owned Customer mapping; configured merchant acct_1Gn4gwGqAtOWOEjZ(ccgroup.lv), configured EUR monthly Price and product metadata. Stripe23.0.0, stable2026-09-30.endive API verified against current official docs/package. Signed raw webhook, mode/account/ownership/price guards; canonical Subscription/latest Invoice; paid-until entitlement; renewal, replay, stale-event, failed-payment and cancellation handling. Redirect success never grants capacity. VAT-policy readiness is a separate merchant activation gate; automatic tax also verifies active settings, registration and an explicitly configured product tax code.

## Commercial/provider split

Customers purchase a capacity add-on from CCGROUP, receiving a shared workspace entitlement. Stripe settles proceeds to the merchant's configured payout account. Cloudflare independently bills the operator's configured payment method for aggregate D1/R2/Worker usage. There is no per-customer vendor payout, Connect marketplace or automatic bank/card enrollment in this implementation. Provider storage/operation costs and AI/enrichment fees are separate from the retail storage price. No actual customer charge, live subscription or provider payment was made during acceptance.

EUR9/month is the engineering pricing assumption/draft. Stripe already contains unrelated recurring prices; none was reused or modified. An inactive product creation attempt twice returned an authentication request accepted response without a completed write. Do not report the product as created unless a later verified connector response proves it. Production billing remains explicitly false, without a configured Price or Worker Stripe credentials in this source. The app shows Billing setup is in progress rather than pretending payment works.

## Activation boundary

Complete secure Worker restricted-key/webhook setup and confirmed merchant Price/VAT policy before enabling charging. Current connector authorization in ChatGPT does not supply runtime credentials to the Worker. No keys belong in chat, repository, customer settings or browser workspace. A live charge flow needs separate end-to-end Stripe acceptance with those configured resources; signed fixture tests are not real customer payments.

Shared D1 physical capacity, indexes and backups remain operator costs. Per-workspace logical limits do not expand D1's physical database maximum. Before opening billing generally, check provider capacity/headroom and establish sharding as customer count grows; charging a workspace must not promise unlimited platform storage. Refunds/disputes are merchant operations; this version preserves already-paid-period capacity through cancellation and does not automate bank transfers or refunds.

## Verification

See completion response for exact final suite/build counts and release proof. Local tests include actual Workers D1 migration/authorization/quota execution, plus real SQLite concurrent writes/rollback/Unicode/cascade, private R2 failure/recovery and Stripe signed events. Customer tests cover public-link privacy, stale workspace responses, disabled billing setup and red/yellow alerts. Exact-SHA production proof and authenticated Settings observation are additional gates.

## Production migration transport correction

The first main release3e87dbaf764b563c5af990fdb759e7906426f293 passed both CI suites, but Backend Deploy38209696089 failed before Worker deployment: Cloudflare query endpoint returned incomplete input: SQLITE_ERROR. The complete SQL and all186 queries split by Wrangler4.132.0 execute successfully in SQLite; actual Workers D1 prepared-statement tests also pass. This locates the observed failure in the remote migration transport, rather than establishing a precise server-parser defect. Do not credit that release with a working storage API.

Use Cloudflare's documented wrangler d1 execute --remote --file import for pending migrations. Read the existing standard migration ledger, keep original SQL unchanged, include the completion INSERT in the same imported file, confirm the ledger after success and stop deployment on any failure. Native file imports restore their original database state on failure. Nothing exports customer records or removes business data. A migration regression executes the real SQL/ledger, skips applied migrations and verifies the file-import route. Exact main CI/deploy/release proof remains mandatory after the correction.
