import assert from 'node:assert/strict';
import { classifyLegacyOrder } from '../scripts/lib/russo_backfill_policy.mjs';

assert.equal(classifyLegacyOrder({ supplierId:'pagnottella', createdAt:new Date() }).status, 'excluded');
assert.equal(classifyLegacyOrder({ createdAt:new Date('2026-02-11T08:54:45.233Z'), orderType:'order' }).status, 'certain-russo');
assert.equal(classifyLegacyOrder({ createdAt:new Date('2026-07-30T07:41:32.003Z'), posate:'No' }).status, 'certain-russo');
assert.equal(classifyLegacyOrder({ createdAt:new Date('2026-07-30T07:41:32.003Z'), supplierName:'La Pagnottella Gourmet' }).status, 'ambiguous');
assert.equal(classifyLegacyOrder({ createdAt:new Date('2026-08-01T10:00:00.000Z'), posate:'No' }).status, 'ambiguous');
assert.equal(classifyLegacyOrder({ orderType:'order' }).status, 'ambiguous');
console.log('russo-backfill-policy-tests: passed');

