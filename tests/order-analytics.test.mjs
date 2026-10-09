import test from 'node:test';
import assert from 'node:assert/strict';
await import('../pagnottella-gourmet/order-analytics.js');
const a = globalThis.DoseOrderAnalytics;
const now = new Date('2026-10-09T13:00:00Z');
const order = (overrides = {}) => ({ id:'one', supplierId:'pagnottella', createdAt:'2026-10-09T09:00:00Z', uid:'u1', email:'u@dos.design', user:'Uno', total:10, items:[{id:'p1', name:'Panino', quantity:1}], ...overrides });
const selected = (rows, args = {}) => a.select(rows, {now, range:a.rangeFor('all', now), ...args});

test('Rome calendar ranges, DST, inclusive dates, today not rolling 24h', () => {
  const range = a.rangeFor('today', now);
  assert.equal(range.startDate.toISOString(), '2026-10-08T22:00:00.000Z');
  assert.equal(range.endDate.toISOString(), '2026-10-09T22:00:00.000Z');
  assert.equal(a.rangeFor('7', now).from, '2026-10-03');
  const spring = a.rangeFor('custom', now, '2026-03-29', '2026-03-29');
  assert.equal((spring.endDate - spring.startDate) / 3600000, 23);
  const autumn = a.rangeFor('custom', new Date('2026-10-30T12:00:00Z'), '2026-10-25', '2026-10-25');
  assert.equal((autumn.endDate - autumn.startDate) / 3600000, 25);
  assert.throws(() => a.rangeFor('custom', now, '2026-02-30', '2026-10-09'));
  assert.throws(() => a.rangeFor('custom', now, '2026-10-10', '2026-10-10'));
  assert.throws(() => a.rangeFor('custom', now, '2026-10-09', '2026-10-08'));
  assert.equal(selected([order({createdAt:'2026-10-08T21:59:59Z'}),order({id:'two'})], {range}).rows.length, 1);
});

test('identities use normalized emails, not names; missing identity is excluded from user metrics', () => {
  const rows = [order({email:' U@DOS.DESIGN ',total:10}),order({id:'2',user:'Nome diverso',uid:'new-uid',total:20}),order({id:'3',email:'',total:30}),order({id:'4',uid:'',email:'',total:40}),order({id:'5',uid:'u2',email:'other@dos.design',user:'Uno',total:50})];
  const result = a.aggregate(selected(rows).rows);
  assert.equal(result.count, 5); assert.equal(result.uniqueUsers, 2); assert.equal(result.repeatRate, .5);
  assert.equal(result.missingIdentity, 1); assert.equal(result.perUserCents, 5500); assert.equal(result.cents, 15000);
});

test('money is integer cents with disjoint reconciliation buckets and honest empty ratios', () => {
  const rows = [order({total:.1,reconciled:true,paymentStatus:'reconciled'}),order({id:'2',total:.2,paymentStatus:'declared_paid'}),order({id:'3',total:1,reconciled:false,paymentStatus:'paid'}),order({id:'4',total:2,paymentStatus:'paid'})];
  const r = a.aggregate(selected(rows).rows);
  assert.equal(r.cents, 330); assert.equal(r.reconciledCents, 210); assert.equal(r.declaredCents, 20); assert.equal(r.unverifiedCents, 100);
  assert.equal(r.pendingCents, 120); assert.equal(r.paymentConflicts, 1);
  assert.equal(a.aggregate([]).repeatRate,null); assert.equal(a.aggregate([]).averageCents,null);
});

test('quality excludes malformed, future, cancelled and duplicate documents without silently assigning suppliers', () => {
  const rows = [order(),order(),order({id:'2',createdAt:null}),order({id:'3',total:'10'}),order({id:'4',status:'cancelled'}),order({id:'5',orderType:'test'}),order({id:'6',items:[]}),order({id:'7',items:[{name:'x',quantity:-2}]}),order({id:'8',createdAt:'2026-10-09T20:00:00Z'}),order({id:'9',supplierId:null})];
  const r = selected(rows);
  assert.equal(r.rows.length,2); assert.equal(r.excluded,8); assert.equal(r.exclusions.duplicateDocument,1);
  assert.equal(selected(rows,{supplier:'russo'}).rows.length,0);
  assert.equal(selected(rows,{supplier:'unclassified'}).rows.length,1);
});

test('per-supplier cutoffs use Rome exact seconds; legacy has no implied cutoff', () => {
  const rows = [order({supplierId:'russo',createdAt:'2026-10-09T09:30:00Z'}),order({id:'2',supplierId:'russo',createdAt:'2026-10-09T09:30:01Z'}),order({id:'3',createdAt:'2026-10-09T10:00:00Z'}),order({id:'4',createdAt:'2026-10-09T10:00:01Z'}),order({id:'5',supplierId:undefined})];
  const r = a.aggregate(selected(rows).rows);
  assert.equal(r.cutoffCount,2); assert.equal(r.cutoffEligible,4); assert.equal(r.cutoffRate,.5); assert.equal(r.unclassified,1);
  for (const group of r.suppliers.filter(g=>g.id!=='unclassified')) assert.equal(group.cutoffCount/group.cutoffEligible,.5);
});

test('product quantities and suppliers remain separate; daily series chronological; suspected duplicates flagged not discarded', () => {
  const rows = [order({clientOrderId:'x',items:[{id:'p1',name:'Panino',qty:3}],createdAt:'2026-10-08T09:00:00Z'}),order({id:'2',clientOrderId:'x',items:[{id:'p1',name:'Panino',quantity:2}]}),order({id:'3',supplierId:'russo'})];
  const r = a.aggregate(selected(rows).rows);
  assert.equal(r.units,6); assert.equal(r.topProducts.length,2); assert.equal(r.topProducts[0][1],5);
  assert.deepEqual(r.days.map(([day])=>day),['2026-10-08','2026-10-09']); assert.equal(r.possibleDuplicates,1); assert.equal(r.count,3);
});

test('CSV uses same selected perimeter, quantities, BOM and formula protection', () => {
  const rows = selected([order({user:'=HYPERLINK("bad")',items:[{name:'Panino',quantity:2}]}),order({id:'other',supplierId:'russo'})],{supplier:'pagnottella'}).rows;
  const csv = a.csv(rows);
  assert.ok(csv.startsWith('\uFEFF')); assert.match(csv,/'=HYPERLINK/); assert.match(csv,/2x Panino/);
  assert.equal(csv.split('\r\n').length,2); assert.doesNotMatch(csv,/Alimentari Russo/);
});
