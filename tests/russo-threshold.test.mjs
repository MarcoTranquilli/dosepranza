import test from 'node:test';
import assert from 'node:assert/strict';
await import('../pagnottella-gourmet/order-analytics.js');
const a = globalThis.DoseOrderAnalytics;
const now = new Date('2026-10-19T08:29:59Z');
const order = (id, total, patch = {}) => ({id, total, supplierId:'russo', orderType:'order', createdAt:'2026-10-19T08:00:00Z', ...patch});

test('collective threshold uses exact cents: 0, 15.50, 19.99, 20 and above', () => {
  for (const [total, missing, status] of [[0,2000,'STATO_IN_ATTESA'],[15.5,450,'STATO_IN_ATTESA'],[19.99,1,'STATO_IN_ATTESA'],[20,0,'STATO_CONFERMATO'],[25,0,'STATO_CONFERMATO']]) {
    const s = a.russoThreshold(total ? [order('a', total)] : [], {now});
    assert.equal(s.totalCents, Math.round(total * 100)); assert.equal(s.missingCents, missing); assert.equal(s.status, status);
    assert.ok(s.progress >= 0 && s.progress <= 1);
  }
  assert.equal(a.russoThreshold([order('a', 9.99), order('b', 10.01)], {now}).totalCents, 2000);
});
test('cutoff is strict at 10:30; late orders cannot retroactively confirm', () => {
  const after = new Date('2026-10-19T08:30:00Z');
  assert.equal(a.russoThreshold([order('a', 19.99)], {now:after}).status, 'STATO_NON_CONFERMATO');
  assert.equal(a.russoThreshold([order('a', 20)], {now:after}).status, 'STATO_CONFERMATO');
  assert.equal(a.russoThreshold([order('a', 100, {createdAt:after})], {now:after}).totalCents, 0);
});
test('scope: only today in Rome, no other suppliers, duplicates, cancellation, tests or invalid money', () => {
  const rows = [order('ok', 4), order('ok', 4), order('pg', 100, {supplierId:'pagnottella'}),
    order('legacy', 100, {supplierId:undefined}), order('old', 100, {createdAt:'2026-10-18T19:00:00Z'}),
    order('future', 100, {createdAt:'2026-10-19T08:29:59.500Z'})];
  for (const field of ['status','orderStatus','paymentStatus']) rows.push(order(field, 100, {[field]:'cancelled'}));
  for (const flag of ['isTest','test','e2e']) rows.push(order(flag, 100, {[flag]:true}));
  for (const total of [NaN,Infinity,0,-1,'20',1.001]) rows.push(order(`invalid-${total}`, total));
  assert.equal(a.russoThreshold(rows, {now}).totalCents, 400);
  assert.equal(a.russoThreshold([order('midnight', 2, {createdAt:'2026-10-18T22:00:00Z'})], {now}).totalCents, 200);
});
test('winter, summer and transition Sundays resolve Rome cutoff independently of host timezone', () => {
  for (const [date, utc] of [['2026-01-15','09:30'],['2026-07-15','08:30'],['2026-03-29','08:30'],['2026-10-25','09:30']]) {
    const at = new Date(`${date}T${utc}:00Z`);
    const s = a.russoThreshold([], {now:at}); assert.equal(s.cutoff, at.toISOString()); assert.equal(s.status,'STATO_NON_CONFERMATO');
    assert.equal(a.russoThreshold([], {now:new Date(at.getTime()-1)}).status,'STATO_IN_ATTESA');
  }
});
test('Pagnottella analytics remains independent and unchanged by Russo threshold', () => {
  const pg = {id:'pg', supplierId:'pagnottella', total:5, createdAt:'2026-10-19T09:59:00Z', items:[{name:'Panino', quantity:1}]};
  const selected = a.select([pg], {now:new Date('2026-10-19T10:01:00Z'), range:a.rangeFor('today', now)});
  const summary = a.aggregate(selected.rows); assert.equal(summary.cents,500); assert.equal(summary.cutoffCount,1);
  assert.equal(a.russoThreshold([pg], {now:new Date('2026-10-19T10:01:00Z')}).totalCents,0);
});
