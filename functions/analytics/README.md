# Admin analytics digest

CommonJS / Node 22; no new dependency. New export: `adminAnalyticsDigest`.
Weekly schedule: Monday 08:00 Europe/Rome. Disabled by default.

## Configuration and release (not executed)

- `ADMIN_DIGEST_ENABLED=true` explicitly enables sending.
- `ADMIN_REPORT_EMAIL`: exactly one administrator mailbox; default marco.tranquilli@dos.design.
- `ADMIN_DIGEST_PERIOD=30days` (default): last 30 **complete Rome calendar days**, excluding today.
- `ADMIN_DIGEST_PERIOD=week`: previous complete Monday-Sunday week.
- Existing SMTP_USER, Secret Manager SMTP_PASS, ORDER_CONFIRM_FROM are reused.
- Calculator accepts topN 5 or 10 (scheduler uses 5).

Targeted deploy only after review:

```
firebase deploy --project app-ordini-pranzo-alimentari --config firebase.russo-email.json --only functions:russo-email:adminAnalyticsDigest
```

No public HTTP endpoint. Manual execution, if necessary, uses the IAM-protected Scheduler job and sends a real email; tests mock SMTP instead.

## Definitions and limitations

All ranges are [startUtc, endUtc); midnight is resolved from Intl Europe/Rome civil parts with hourCycle h23, without fixed offsets. Draft selection uses the `day` string, not mutable updatedAt. Orders use createdAt Timestamp. Existing total/uid/email/qty/cat fields and requested totalAmount/userId/userEmail/quantity/category are supported.

Funnel unit is supplier + user + Rome day. Multiple orders that day count separately for AOV/volume but as one converted attempt. A draft matching an order is not counted twice. DRAFT/CANCELLED/EMPTY/CONFIRMED all evidence a started attempt; a CONFIRMED draft without a matching order is flagged, not assumed purchased. This is an observed snapshot estimate, not an event-sourced session conversion metric. Deleted/overwritten drafts cannot be recovered.

Cancelled, refunded, non-confirmed, draft, test and non-order records are excluded. Unknown suppliers are never attributed to Russo implicitly. Invalid identities, money, timestamps and items are counted and excluded. Firestore range queries cannot discover documents lacking their indexed date field: diagnostics cover fetched records only. Alias reconciliation uses email-to-UID mappings present in the fetched period.

Revenue means ordered value, NOT collected or reconciled money. Product/category revenue sums stored unit price times quantity; mismatch with order total is counted (discounts/fees are not allocated without evidence). Weekend counts are retained. Post-cutoff is a subset of hourly totals, not an additional bucket.

## Idempotence and privacy

Only `orders` and `drafts` are read. Neither they nor daily_batches are modified. A separate server-owned `admin_digest_runs` ledger uses a transaction to claim the window/recipient before SMTP. Any existing SENDING/ACCEPTED/REVIEW_REQUIRED claim blocks automatic resend, including concurrent workers. No automatic lease expiry: ambiguous SMTP acceptance requires human review. ACCEPTED is not proof of Inbox delivery. A crash can leave SENDING; investigate before any manual reset.

Runtime IAM needs entity reads/query and create/update for the ledger (Admin SDK bypasses Rules). Confirm the current custom role before deploy; this task does not change IAM or client Rules. Ensure no broad client rule exposes the ledger. Do not grant client access.

Logs contain aggregate counts/status only, not addresses, names, token values or SMTP response payloads. Top-user identities are delivered only to configured admin. HTML escapes all data. No bulk recipients or BCC. 500-row pagination with a 50,000-row limit per collection fails explicitly rather than sending a truncated report.

## Tests

`npm test --prefix functions`

Tests cover zero/one/many orders, segment isolation, schema aliases, deduplication, DST 23/25 hour days, half-open ranges, summer/winter hours, weekdays/weekends, cutoff, malformed/cancelled records, HTML escaping, single-recipient SMTP, duplicate suppression, ambiguous failure and pagination. No production data read or email sent.
