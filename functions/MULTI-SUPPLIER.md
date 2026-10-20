# Multi-supplier rollout (not deployed)

Russo: confirmation 10:30, minimum EUR 20; reminder 10:05.
Pagnottella: direct confirmation 11:00; reminder 10:35.
All schedules use Europe/Rome, Monday-Friday.

REMINDERS_ENABLED defaults to false. Do not enable until checkout synchronization is implemented.
Backend expects drafts documents with supplierId, day (Rome YYYY-MM-DD),
status DRAFT, authenticated userId/userEmail, nonempty items, reminderSent false.
Finalize with orderId/finalizedAt and non-DRAFT status when checkout completes;
clear items when cart is emptied. These writes must use authenticated ownership,
not an arbitrary client-supplied email. Client synchronization and draft Rules are now prepared locally; emulator/browser validation is still required.
A composite query index (supplierId, day, status, reminderSent) may be required before rollout.

Reminder receipts are daily per supplier/email in draft_reminders. SENDING/uncertain
receipts are never automatically retried. ACCEPTED is SMTP acceptance, not delivery.
A final draft read reduces but cannot eliminate the checkout/send race; reminder copy
explicitly tells users to ignore the message if already completed.

Pagnottella frontend cutoff must be aligned and WhatsApp finalization semantics verified
before publishing the new 11:00 confirmation job. Existing order documents are not changed.
SMTP_PASS configuration currently requires correction (last live check failed validation).

Local integration: shared/cart-sync.js debounces writes and preserves reminder flags.
CONFIRMED drafts are terminal for the same supplier/user/day (additional same-day carts are not reminded).
No production deployment or live checkout test has been performed.
