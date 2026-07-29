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
- Exact `@dos.design` domain: authenticated customer/tester.
- `commerciale@lapagnottellagourmet.it`: Pagnottella supplier, Pagnottella orders only.
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

Without this activation, the Pagnottella supplier cannot reliably read live orders. The current Russo client also performs a global staff query and therefore does not yet meet strict query-level supplier segregation.

## Release status

Status is **YELLOW** until the Firebase activation gate and the Russo query segregation are completed. Customer ordering and the standalone production UI are testable; full supplier operations must not be declared production-ready before those two controls are closed.
