# Pagnottella Gourmet - Production Readiness

## Scope

The standalone application is built at `dist-production/pagnottella-gourmet/` and published only under `/pagnottella-gourmet/`. The existing approval and Russo paths are not part of this build.

## Commands

```bash
npm run build:pagnottella-production
npm run test:pagnottella-production
```

The build localizes all assets and generates a production menu where age-restricted products are not orderable.

## Access and data

- `marco.tranquilli@dos.design`: administrator, global order view.
- Dominio esatto `@dos.design`: utente interno DOS autenticato (`dos_user`).
- `commerciale@lapagnottellagourmet.it` e `isidorovagnozzi@gmail.com`: Pagnottella supplier, Pagnottella orders only.
- Russo supplier accounts remain assigned to Russo.
- Every new order stores `supplierId: "pagnottella"` and the Firebase authenticated UID.
- The Pagnottella supplier query includes `where("supplierId", "==", "pagnottella")`.
- Production administration does not read orders from `localStorage`.

## Firebase activation gate

The files below are proposals and are intentionally not referenced by `firebase.json` or deployed:

- `firestore.pagnottella-production.proposed.rules`
- `firestore.pagnottella-production.proposed.indexes.json`

Before enabling the Pagnottella supplier account in live operations:

1. Review the proposed Rules against the currently deployed Rules.
2. Validate them in the Firestore emulator with Pagnottella, Russo, admin, DOS user, and external-user cases.
3. Deploy the composite index for `supplierId ASC, createdAt DESC`.
4. Deploy the approved Rules in a controlled maintenance window.
5. Run a live smoke test with one disposable order per authorized role.

Without this activation, the Pagnottella supplier cannot reliably read live orders. The Russo client now writes `supplierId: "russo"` and applies a supplier-scoped Firestore query; legacy orders without `supplierId` must be backfilled before the Rules deployment if they need to remain visible to the supplier.

### Controlled deployment

Dry run:

```bash
firebase deploy --dry-run \
  --only firestore:rules,firestore:indexes \
  --project app-ordini-pranzo-alimentari \
  --config firebase.pagnottella-deploy.json
```

Deploy only after explicit approval:

```bash
firebase deploy \
  --only firestore:rules,firestore:indexes \
  --project app-ordini-pranzo-alimentari \
  --config firebase.pagnottella-deploy.json
```

Post-deploy smoke checks:

1. Marco loads the global order view and analytics.
2. The Pagnottella supplier sees only `supplierId == "pagnottella"`.
3. The Russo supplier sees only `supplierId == "russo"`.
4. A DOS user creates one disposable order per supplier and reads only their own history.
5. An external account cannot read or create orders.

Rollback:

1. Use Firestore Rules release history in Firebase Console to restore the immediately preceding ruleset.
2. Do not delete the composite index during the incident; an unused index does not widen access.
3. Restore the previous GitHub Pages commit if the client release also needs rollback.

## Release status

Status is **YELLOW** until the Firebase activation gate is completed. Query-level Russo segregation is implemented and covered by automated tests, but the supplier-facing release and Rules remain pending.
