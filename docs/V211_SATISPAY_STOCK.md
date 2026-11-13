# v2.11 Satispay and menu availability

## Payment

`shared/satispay-and-stock.js` is the canonical UMD source; the CJS bridge evaluates that same source. Payment links follow https://developers.satispay.com/docs/payment-link: HTTPS universal shop URL with `amount` in cents. Notes are deliberately NOT passed as an undocumented parameter; they remain in the order/WhatsApp message. `noteSupported: false` makes this explicit.

Recipients are configured through `data-satispay-recipient`. Missing recipient hides link/QR but retains Copy amount. A QR is generated locally (Model 2 version 6-L, byte mode, max 134 bytes, quiet zone >=4). It never sends order data to a third-party QR service. Opening Satispay is not payment verification. Pagnottella's WhatsApp send and explicit completion remain required.

## Availability

Documents: `menu_products/dose_stock_russo` and `menu_products/dose_stock_pagnottella`. Fields: supplierId, soldOutItems, soldOutIngredients, updatedAt. No name/key fields: the existing ordered product query must not treat settings as catalog products. Toggle writes use transactions to preserve concurrent edits to other terms.

Supplier editing UI is restricted to each existing supplier whitelist and Marco. Coordinators can read but cannot edit through this UI. **Existing Rules authorize staff across the whole menu_products collection. They do not enforce vendor-specific writes.** No Rules were modified. The emulator test explicitly records this existing boundary rather than asserting stronger isolation.

Only server-confirmed snapshots without pending writes trigger cart removal. The local daily cache (`dose_stock_cache_<supplier>`) and storage events provide read-only fallback, not optimistic publication. Offline editing is disabled; failed writes are reported. Signed-out users cannot read this collection under existing Rules, so anonymous browsing cannot guarantee current availability until login. Settings persist until the supplier restores availability; the cache expires daily, not the server settings.

Stock is a client-side availability guard, not an atomic inventory reservation. Concurrent changes between the last snapshot and order creation remain possible without a backend transaction. Previously submitted orders are not rewritten.

Russo reuses its already initialized Firestore instance, preserving long-polling/cache settings. Static supplier choices are generated from RAW_MENU with `scripts/build_russo_stock_catalog.mjs`; live menu_products/custom_creations names extend that list. Both builds regenerate the static asset. Existing draft keys are preserved; reconciled carts are saved through existing persistence, with the Pagnottella daily helper mirrored alongside pg_draft_cart.

## Verification

- `node --test tests/*.test.cjs`
- `node --test tests/release-integrity.test.mjs`
- `bash scripts/netlify_publish_pdf.sh && npm run build:pagnottella-production`
- Serve repository on 127.0.0.1:8098, then `node scripts/test_v211_browser.cjs` (local E2E identity and mock stock SDK; no production writes).
- `BASE_URL=http://127.0.0.1:8098/?e2e=1 npx playwright test`
- Against a local Firestore emulator with project demo-dose-stock-v211: `node tests/firestore-stock.rules.mjs`.

QR additionally decoded with macOS Vision in verification. Real mobile Satispay app handoff and real supplier accounts are not certified by these tests. No push or deployment is included in this change.
