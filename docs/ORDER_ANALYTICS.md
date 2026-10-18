# Order analytics: metric contract and release gate

## Scope and access

The central Pagnottella admin workspace compares Russo and Pagnottella orders.
Existing permissions are unchanged: global analytics/CSV/reconciliation are admin
only; the Pagnottella supplier receives only its supplierId-scoped query and its
operational view. The Russo application and Firestore Rules are unchanged.

Source: Firestore `orders`, via authenticated onSnapshot. Aggregations execute
in the browser, not in a newly introduced backend service. There are no production
data migrations, automatic payment reconciliations or new persistence writes.

## Definitions

- Periods are inclusive civil dates in Europe/Rome. Today is midnight to next
  midnight, not the trailing 24h; 7/30 include today. Firestore uses >= start, < end.
- Valid orders have a valid nonfuture date, positive numeric total, nonempty
  items and positive integer quantities. Cancelled/draft/void and other orderType
  records are excluded. Identical document IDs are counted once.
- Ordered value is the stored total, rounded per order to cents. It is NOT proof
  of payment, delivery or revenue recognition. There is no recalculation using
  today's menu or discount rules.
- Reconciled: reconciled=true, or legacy paid/reconciled paymentStatus when the
  reconciled flag is absent. False flags override legacy status and are flagged.
- Pending: declared_paid plus unverified. All money partitions sum to ordered.
- Unique users: normalized email, UID fallback. A missing-email UID joins its sole
  known email in the selected set. Names never establish identity. Missing identity
  is excluded from unique users, repeat and per-user money, not from order totals.
- Repeat: users with >=2 valid orders / identified users within the selected set.
  This is not cohort retention. Empty denominators show a dash, not a fabricated 0%.
- Units: item.quantity or item.qty, default 1. Products keyed by supplier and
  product ID, falling back to category+name. Rankings show at most five entries.
- Cutoff: Rome local time <=11:30:00 Russo, <=12:00:00 Pagnottella. Unknown supplier
  IDs are excluded from its denominator and shown separately, never auto-classified.
- Daily ordered amounts are chronological, not the five highest revenue days.
- Repeated clientOrderId flags possible duplicates for investigation, without
  silently discarding separate records.

## Queries, freshness and export

Supplier filtering is in the server query, not merely applied after a global read.
The admin's all/unclassified choice may query a broader perimeter, never suppliers.
Bounded periods use the existing supplierId ASC / createdAt DESC index when needed.
Missing-date records cannot appear in bounded Firestore date queries. Full history
omits orderBy to expose them to quality checks and reads the entire chosen scope.
UI explicitly discloses this completeness/cost distinction. No indexes are deployed.

The same valid rows drive operational cards, analytics, comparison, copy and CSV.
Showing 50 cards is presentation pagination, not a limit on aggregate/export rows.
CSV includes document ID, UTC timestamp, Rome day, supplier, quantities and payment
state, with UTF-8 BOM, quoting and formula-injection protection.

Snapshots label server/cache state and observed time. Errors/account changes clear
old values and late callbacks are ignored by a generation+identity guard. Cache or
pending-write snapshots cannot be exported or reconciled. Loading/errors show
unavailable values, distinct from confirmed empty results.

## Verification and release

Run `npm run test:order-analytics`, including TZ=Pacific/Honolulu; run
`npm run test:pagnottella-production` and `node tests/mobile-cache-recovery.test.mjs`.
Tests use synthetic users/orders and mock Firebase, not production writes.
Browser checks cover filters, calendar predicates, CSV, errors, cache, stale account
listeners, checkout, permissions, and responsive Chromium/WebKit layouts.
The additional pixel project emulates a 448x998 Android-sized touch viewport; it
does not substitute for verification on the physical phone. Critical-script
connection failures reuse the existing single-reload asset recovery without
modifying authentication or credentials.

Build with `npm run build:pagnottella-production`. Release ONLY index.html,
production-admin.js, production.css, order-analytics.js, pagnottella.js,
release-watch.js and release.json under gh-pages/pagnottella-gourmet.
Their cache version is analytics-3. Never publish mocks.
No main, rules, indexes, Netlify settings, authentication or existing orders change.
Rollback these assets together; this release has no data migration to undo.
After publishing, verify asset hashes and actual server queries/index availability
with an authorized account before declaring live analytics validated.

## Resilience and read budget (analytics-3)

- Order listeners are reused for identical identity/supplier/date scopes. An order
  saved event does not restart an already healthy realtime listener. Explicit
  refresh, errors or identity changes can restart it. Firebase UID is part of the
  identity key; late callbacks from a former UID are ignored even for the same email.
- Menu configuration is read only when the menu administration view is opened,
  coalesced while pending and reused for 60 seconds per identity. Explicit changes
  invalidate this brief cache. Order snapshots no longer fetch menu settings.
- release.json is public build metadata, containing no credentials or order data.
  A visible, online page checks at most once per five minutes, without credentials;
  the request aborts after four seconds. Failures never block core functionality.
- A differing release produces an optional update notice. No automatic reload or
  authentication reset takes place. Updating is blocked while cart items, checkout
  writes, authentication or confirmation dialogs are active. The guard is rechecked
  at the click. Cart persistence is NOT claimed: finish/empty it before reloading.
- Dismissing the notice suppresses it for that page session. Older pages without
  the watcher need one manual reload to receive this capability.
- `node tests/release-integrity.test.mjs` checks that HTML cache versions, manifest
  and build copies agree. Update the manifest and HTML together on each release.
- Browser tests start their own loopback-only static server with a 128-connection
  backlog, rather than silently reusing a potentially stale build. Pixel checkout
  scenarios explicitly use the touch cart path. This server is never deployed.

Live read-only verification on 2026-10-12 of analytics-2: server-confirmed Pagnottella
history 38 orders / EUR359.85 / 20 users; classified Russo history 61 / EUR324.30.
Both supplier-specific bounded queries returned server data without new indexes.
These are point-in-time observations, not fixed targets or proof of settlement.

Verification on 2026-10-13 for analytics-3: 70 production browser checks passed
(6 intentional desktop-only exclusions), plus 4 release-notice layout checks,
12 Russo segregation checks, 7 analytics unit tests with TZ=Pacific/Honolulu,
release-manifest consistency, cache recovery and JavaScript syntax checks.
Browsers use synthetic identities/orders. This is not a real-user Google login
or physical Pixel certification, and no production order was created or changed.

## Architectural boundaries

- Keep metric calculation pure and independent from Firebase and the DOM. Query
  ownership belongs to production-admin.js; renderers consume the same scope.
- Session identity includes Firebase UID, email and role. Generation guards reject
  stale async callbacks, independently of UI visibility. Server rules remain the
  authorization boundary; no client cache can grant supplier access.
- Release discovery is an optional, isolated module with bounded polling and a
  checkout-owned safety contract. Discovery failures must not affect ordering.
- Keep this a modular static client for now. Add a backend aggregation pipeline
  only after measuring read cost and agreeing on payment semantics, not as a
  speculative microservice rewrite. No cost-saving percentage is claimed.

## Next decisions, ordered by impact

1. Confirm legacy supplier attribution separately. Do not infer ownership to make
   charts look complete; any backfill needs an explicit approved dry-run/rollback.
2. Agree on the operational meaning of a completed order/payment. WhatsApp opening
   and a customer declaration do not prove fulfillment or settlement. Payment-system
   integration requires separate access and business agreement.
3. Track read volume/latency before adding server-side daily aggregates. Full history
   has linear read cost. A materialized pipeline would require idempotency, replay,
   permissions and reconciliation against raw records before replacement.
4. Add historical comparisons only with comparable windows (partial current day
   versus matched partial day), disclosed missingness and stable supplier coverage.
   No unsupported growth, retention or profitability claims are generated now.
