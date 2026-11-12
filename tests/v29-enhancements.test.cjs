const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../shared/cutoff-time.js'), 'utf8');
const cutoff = require('../shared/cutoff-time.cjs');
const aggregator = require('../shared/order-aggregator.cjs');
const evaluate = (vendor, time, clockOffsetMs = 0) => cutoff.evaluateCutoff(vendor, {nowMs: Date.parse(time), clockOffsetMs});

test('cutoff UMD exposes the same API in browser and CommonJS wrappers', () => {
  const browser = {};
  new Function('module', 'globalThis', source)(undefined, browser);
  assert.deepEqual(Object.keys(browser.DosePranzaCutoff), Object.keys(cutoff));
  assert.ok(Object.isFrozen(cutoff.VENDOR_CUTOFFS));
  assert.ok(Object.isFrozen(cutoff.VENDOR_CUTOFFS.russo));
});

test('Russo starts countdown at 10:10 and blocks at 10:30 Rome', () => {
  assert.equal(evaluate('russo', '2026-11-12T09:09:59Z').isCountdownActive, false);
  const start = evaluate('russo', '2026-11-12T09:10:00Z');
  assert.equal(start.formattedRemaining, '20:00');
  assert.equal(start.isCountdownActive, true);
  assert.equal(start.isBlocked, false);
  assert.equal(evaluate('russo', '2026-11-12T09:29:59Z').formattedRemaining, '00:01');
  const end = evaluate('russo', '2026-11-12T09:30:00Z');
  assert.equal(end.isBlocked, true);
  assert.equal(end.isCountdownActive, false);
  assert.equal(end.formattedRemaining, '00:00');
});

test('Pagnottella countdown never blocks orders, including after 11:00', () => {
  assert.equal(evaluate('pagnottella', '2026-11-12T09:39:59Z').isCountdownActive, false);
  assert.equal(evaluate('pagnottella', '2026-11-12T09:40:00Z').formattedRemaining, '20:00');
  for (const time of ['10:00:00', '10:00:01', '22:59:59']) {
    const result = evaluate('pagnottella', `2026-11-12T${time}Z`);
    assert.equal(result.isPassed, true);
    assert.equal(result.isBlocked, false);
  }
});

test('Rome date, midnight and summer time determine prep keys without fixed offsets', () => {
  const midnight = evaluate('russo', '2026-07-01T22:00:00Z');
  assert.equal(midnight.romeTime, '00:00:00');
  assert.equal(midnight.prepStorageKey, 'dosepranza_prep_2026-07-02');
  assert.equal(evaluate('russo', '2026-07-01T08:30:00Z').isBlocked, true);
  assert.equal(cutoff.getRomeDateParts(Date.parse('2026-03-29T01:00:00Z')).hour, 3);
  for (const hour of ['00', '01']) assert.equal(cutoff.getRomeDateParts(Date.parse(`2026-10-25T${hour}:30:00Z`)).hour, 2);
});

test('HTTP clock offsets apply before date and cutoff calculation', () => {
  const local = Date.parse('2026-11-12T09:20:00Z');
  const offset = cutoff.computeClockOffsetMs('Thu, 12 Nov 2026 09:30:00 GMT', local);
  assert.equal(offset, 600000);
  assert.equal(cutoff.evaluateCutoff('russo', {nowMs: local, clockOffsetMs: offset}).isBlocked, true);
  assert.equal(evaluate('russo', '2026-11-12T09:30:00Z', -600000).isBlocked, false);
  for (const invalid of [undefined, null, '', 'invalid', 12]) assert.equal(cutoff.computeClockOffsetMs(invalid, local), 0);
  assert.equal(cutoff.computeClockOffsetMs('Thu, 12 Nov 2026 09:30:00 GMT', NaN), 0);
});

test('countdown sanitizes invalid values and rejects unsupported vendors', () => {
  for (const value of [NaN, Infinity, -10, undefined]) assert.equal(cutoff.formatCountdownMMSS(value), '00:00');
  assert.equal(cutoff.formatCountdownMMSS(61.9), '01:01');
  for (const vendor of ['unknown', 'constructor', '__proto__']) assert.throws(() => cutoff.evaluateCutoff(vendor), /non supportato/);
  assert.throws(() => cutoff.getRomeDateParts(Number.MAX_VALUE), RangeError);
});

test('haptics respect reduced motion and tolerate unavailable or throwing Web APIs', () => {
  let calls = 0;
  const nav = {vibrate(pattern) {calls++; assert.equal(pattern, 15); return true;}};
  assert.equal(cutoff.triggerSafeHaptic(15, {matchMedia: () => ({matches: true})}, nav), false);
  assert.equal(calls, 0);
  assert.equal(cutoff.triggerSafeHaptic(15, {matchMedia: () => ({matches: false})}, nav), true);
  assert.equal(calls, 1);
  assert.equal(cutoff.triggerSafeHaptic(15, {}, null), false);
  assert.equal(cutoff.triggerSafeHaptic(15, {matchMedia() {throw new Error('blocked');}}, nav), false);
  assert.equal(cutoff.triggerSafeHaptic(15, {}, {vibrate() {throw new Error('blocked');}}), false);
});


test('aggregator computes exact cents and preparation/payment breakdown', () => {
  const summary = aggregator.aggregateOrders([
    {id: 'ord-1', paymentMethod: 'satispay', items: [{name: 'Rosetta Crudo e Bufala', qty: 1, price: 4.5}]},
    {id: 'ord-2', pagamento: 'contanti', items: [{name: 'Focaccia Mortadella', quantity: 1, price: 3.2}]}
  ], {'ord-1': true});
  assert.equal(summary.totalOrders, 2);
  assert.equal(summary.readyOrders, 1);
  assert.equal(summary.pendingOrders, 1);
  assert.equal(summary.totalAmountCents, 770);
  assert.equal(summary.formattedTotal, '7,70 €');
  assert.equal(summary.byPayment.Satispay.formatted, '4,50 €');
  assert.equal(summary.byPayment.Contanti.formatted, '3,20 €');
});

test('aggregator groups normalized variants, deduplicates notes and excludes cancellations', () => {
  const orders = [
    {items: [{name: 'Supplì Classico', qty: 2, price: 2}, {name: 'Panino Porchetta', variant: 'Integrale', price: 5.5, note: 'No cipolla'}]},
    {items: [{name: ' supplì classico ', qty: 1, price: 2}, {name: 'panino porchetta', variant: ' integrale ', price: 5.5, note: 'Allergia noci'}]},
    {cancelled: true, items: [{name: 'Supplì Classico', qty: 5, price: 2}]},
    {status: 'cancelled', total: 99}
  ];
  const original = JSON.stringify(orders);
  const summary = aggregator.aggregateOrders(orders);
  assert.equal(summary.totalOrders, 2);
  assert.equal(summary.itemsSummary.length, 2);
  assert.equal(summary.itemsSummary[0].qty, 3);
  assert.deepEqual(Array.from(summary.itemsSummary[1].notes), ['No cipolla', 'Allergia noci']);
  assert.equal(JSON.stringify(orders), original);
  const text = aggregator.formatKitchenSummaryText(summary, {vendorLabel: 'Pagnottella Gourmet', isoDate: '2026-11-12'});
  assert.match(text, /Pagnottella Gourmet \(2026-11-12\)/);
  assert.match(text, /3× Supplì Classico/);
  assert.ok(text.includes('2× Panino Porchetta [Integrale] — Note: No cipolla; Allergia noci'));
  assert.doesNotMatch(text, /Bonifico/i);
  const repeated = aggregator.aggregateOrders([{items: [{name: 'Pane', note: 'No sale'}, {name: 'Pane', note: ' No sale '}]}]);
  assert.deepEqual(Array.from(repeated.itemsSummary[0].notes), ['No sale']);
});

test('aggregator preserves explicit totals, zero cents, aliases and alphabetical ties', () => {
  const summary = aggregator.aggregateOrders([
    {totalCents: 0, total: 99, items: [{name: 'Zucchine', price: 9}]},
    {total: '7,70 €', pagamento: 'cash', items: [{name: 'Acqua', priceCents: 0, price: 20}]},
    {items: [{name: 'Pane', priceCents: 125, quantity: 2}]}
  ]);
  assert.equal(summary.totalAmountCents, 1020);
  assert.equal(summary.byPayment.Contanti.amountCents, 770);
  assert.deepEqual(summary.itemsSummary.map(item => item.name), ['Pane', 'Acqua', 'Zucchine']);
  assert.equal(aggregator.formatEuroCents(-125), '-1,25 €');
});

test('aggregator handles empty/malformed input without NaN and rejects unsafe arithmetic', () => {
  assert.equal(aggregator.aggregateOrders(null).formattedTotal, '0,00 €');
  const summary = aggregator.aggregateOrders([{id: 'toString', items: [null, {name: '  '}, {name: 'Pane', qty: 'invalid', price: 2}, {name: 'Acqua', qty: Infinity, price: 1}]}], {});
  assert.equal(summary.readyOrders, 0);
  assert.equal(summary.totalAmountCents, 300);
  assert.equal(summary.itemsSummary.length, 2);
  assert.throws(() => aggregator.aggregateOrders([{totalCents: Number.MAX_SAFE_INTEGER}, {totalCents: 1}]), RangeError);
});

test('dashboard modules use relative existing paths and expose browser aggregator API', () => {
  for (const page of ['russo/ordini.html', 'pagnottella-gourmet/ordini.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
    for (const module of ['cutoff-time', 'order-aggregator']) {
      assert.ok(html.includes(`<script defer src="../shared/${module}.js"></script>`));
      assert.ok(fs.existsSync(path.resolve(__dirname, '..', path.dirname(page), `../shared/${module}.js`)));
    }
  }
  const browser = {};
  const content = fs.readFileSync(path.join(__dirname, '../shared/order-aggregator.js'), 'utf8');
  new Function('module', 'globalThis', content)(undefined, browser);
  assert.equal(browser.DosePranzaAggregator.aggregateOrders().totalOrders, 0);
  for (const content of [source, fs.readFileSync(path.join(__dirname, '../shared/order-aggregator.js'), 'utf8')]) {
    assert.equal(/(?:src|href)\s*=\s*['"]\/(?!\/)/.test(content), false);
  }
});

test('client cutoff scripts resolve inside the GitHub Pages subpath including Russo base', () => {
  for (const page of ['russo/index.html', 'pagnottella-gourmet/index.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
    const matches = [...html.matchAll(/<script defer src="([^"]*cutoff-time\.js)"><\/script>/g)];
    assert.equal(matches.length, 1);
    const pageUrl = new URL(page, 'https://example.test/dosepranza/');
    const base = new URL(html.match(/<base[^>]+href="([^"]+)"/)?.[1] || '', pageUrl);
    assert.equal(new URL(matches[0][1], base).pathname, '/dosepranza/shared/cutoff-time.js');
  }
});
