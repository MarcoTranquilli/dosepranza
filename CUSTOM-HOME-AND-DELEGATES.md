# Customer personalization and order coordinators

Development only: feature/custom-home-and-delegates, baseline main 127484d.
No deployment, IAM, authentication settings or production data changes.

## Access

Verified Google identities Marco, Marta Diamantini and Luca Pacella may read all /orders dates and suppliers. The coordinator panel opens on today's Rome calendar day and supports date selection. Full documents (including contact and allergy information) are accessible by the expressly authorized Rules; hiding columns is not security. Delegates are NOT assigned admin/staff roles and gain no writes to others' orders or other collections. Existing owner order creation is retained. Marco's existing logistics/reconciliation capabilities are preserved.

Rules also prevent client creation of confirmation fields and replace changedKeys with affectedKeys for admin updates to prevent adding unauthorized fields. No orders are backfilled.

## Personalization

Private /users/{uid}.favorites map keyed by supplier, max 100 per supplier. Only favorites fields can be changed through this path; no role escalation. Uses real Firebase identity, never localStorage authorization. UI clears on logout/account change and discards stale asynchronous results.

Latest explicitly CONFIRMED order queried by actual owner field `uid`, supplier and createdAt descending. Historical submitted/declared_paid orders are NOT assumed confirmed. Required composite index included. Reorder checks catalog and cutoff again on click; existing cart is preserved, new items appended at current prices. Changed or unrecognized variants/options are rejected for manual selection, not silently substituted. Russo custom/portion orders currently require manual reconstruction. Pagnottella recognized options/extras are reconciled to current data. Nothing is submitted or paid automatically.

Next-service-day reopening cannot be promised from cutoff alone (closures/holidays); UI instructs users to verify service availability. No new inferred dietary preferences.

## Verification

- node --test tests/customer-core.test.mjs tests/order-analytics.test.mjs
- Firestore emulator: tests/customer-access.rules.test.mjs (port 8194, demo project only)
- npm run build:pagnottella-production

Still required before release: browser integration/mobile UX, account-switch races under real UI interaction, supplier catalog loading and existing checkout regressions. Rules and index need reviewed deployment before online use. No production permissions are enabled yet.
