const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

global.DosePranzaAggregator = require('../shared/order-aggregator.js');
const {
  buildKitchenProductionState,
  renderBagLabelHtml,
  renderKitchenSummaryHtml,
  createWakeLockController,
  escapeHtml
} = require('../shared/kitchen-display.js');

test('v212 KDS: aggregates items, variants, ready/pending counts and active notes while excluding cancelled orders', () => {
  const orders = [
    {
      id: 'ORD-1',
      user: 'Marco Tranquilli',
      paymentMethod: 'satispay',
      total: 16.5,
      notes: 'Senza cipolla',
      items: [
        { name: 'Apollo', variant: 'Integrale', qty: 2, price: 8.25 }
      ]
    },
    {
      id: 'ORD-2',
      user: 'Luca Pacella',
      paymentMethod: 'contanti',
      total: 8.25,
      allergies: 'Allergia noci',
      items: [
        { name: 'Apollo', variant: 'Integrale', qty: 1, price: 8.25 }
      ]
    },
    {
      id: 'ORD-3',
      user: 'Utente Annullato',
      cancelled: true,
      total: 10,
      items: [{ name: 'Diavola', qty: 1, price: 10 }]
    }
  ];

  const state = buildKitchenProductionState(orders, { 'ORD-1': true });
  assert.equal(state.totalOrders, 2);
  assert.equal(state.readyOrders, 1);
  assert.equal(state.pendingOrders, 1);
  assert.equal(state.itemsSummary.length, 1);
  assert.equal(state.itemsSummary[0].name, 'Apollo');
  assert.equal(state.itemsSummary[0].variant, 'Integrale');
  assert.equal(state.itemsSummary[0].qty, 3);
  assert.equal(state.activeNotes.length, 2);
  assert.equal(state.activeNotes[0].customer, 'Marco Tranquilli');
  assert.equal(state.activeNotes[1].note, 'Allergia noci');
});

test('v212 KDS: bag label and kitchen summary HTML escape untrusted user input and omit bonifico', () => {
  const maliciousOrder = {
    id: 'ORD-XSS',
    user: '<script>alert("xss")</script>Mario',
    paymentMethod: 'satispay',
    total: 9.5,
    notes: 'No <img src=x onerror=alert(1)> maionese',
    items: [
      { name: 'Panino <b>Speciale</b>', variant: 'Pane & Cereali', qty: 2 }
    ]
  };

  const labelHtml = renderBagLabelHtml(maliciousOrder, {
    vendorLabel: 'La Pagnottella Gourmet',
    day: '2026-11-13'
  });

  assert.equal(labelHtml.includes('<script>'), false);
  assert.equal(labelHtml.includes('<img'), false);
  assert.ok(labelHtml.includes('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;Mario'));
  assert.ok(labelHtml.includes('Panino &lt;b&gt;Speciale&lt;/b&gt;'));
  assert.ok(labelHtml.includes('Pagamento: Satispay'));
  assert.equal(/bonifico/i.test(labelHtml), false);

  const summaryState = buildKitchenProductionState([maliciousOrder], {});
  const summaryHtml = renderKitchenSummaryHtml(summaryState, {
    vendorLabel: 'La Pagnottella Gourmet',
    day: '2026-11-13'
  });
  assert.equal(summaryHtml.includes('<script>'), false);
  assert.equal(/bonifico/i.test(summaryHtml), false);
});

test('v212 KDS: WakeLock controller handles acquire, release, visibilitychange and unsupported fallback', async () => {
  let requests = 0;
  let releases = 0;
  const listeners = new Map();
  const store = new Map();

  const mockDoc = {
    visibilityState: 'visible',
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type) { listeners.delete(type); }
  };

  const mockNav = {
    wakeLock: {
      async request(type) {
        assert.equal(type, 'screen');
        requests++;
        const releaseListeners = [];
        return {
          released: false,
          addEventListener(ev, cb) { if (ev === 'release') releaseListeners.push(cb); },
          async release() {
            this.released = true;
            releases++;
            releaseListeners.forEach(cb => cb());
          }
        };
      }
    }
  };

  const mockStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };

  const ctrl = createWakeLockController({
    navigator: mockNav,
    document: mockDoc,
    storage: mockStorage
  });

  assert.equal(ctrl.isSupported(), true);
  assert.equal(ctrl.isEnabled(), false);

  const ok = await ctrl.toggle();
  assert.equal(ok, true);
  assert.equal(ctrl.isEnabled(), true);
  assert.equal(ctrl.isActive(), true);
  assert.equal(requests, 1);
  assert.equal(store.get('dosepranza_kds_wakelock'), '1');

  // Simula perdita lock dal sistema operativo e ritorno scheda visibile
  await ctrl.release();
  assert.equal(ctrl.isActive(), false);
  assert.equal(ctrl.isEnabled(), true);
  listeners.get('visibilitychange')?.();
  await new Promise(r => setImmediate(r));
  assert.equal(requests, 2);
  assert.equal(ctrl.isActive(), true);

  await ctrl.toggle();
  assert.equal(ctrl.isEnabled(), false);
  assert.equal(ctrl.isActive(), false);
  assert.equal(store.has('dosepranza_kds_wakelock'), false);
  assert.ok(releases >= 2);
  await ctrl.destroy();

  // Browser senza WakeLock API
  const unsupported = createWakeLockController({
    navigator: {},
    document: { addEventListener() {}, removeEventListener() {} },
    storage: mockStorage
  });
  assert.equal(unsupported.isSupported(), false);
  assert.equal(await unsupported.toggle(), false);
  assert.equal(unsupported.isActive(), false);
});

test('v212 KDS: both supplier dashboards resolve kitchen-display assets and forbid bonifico on Pagnottella', () => {
  for (const page of ['russo/ordini.html', 'pagnottella-gourmet/ordini.html']) {
    const html = fs.readFileSync(page, 'utf8');
    assert.match(html, /href="\.\.\/shared\/kitchen-display\.css/);
    assert.match(html, /src="\.\.\/shared\/kitchen-display\.js/);
    assert.match(html, /src="\.\.\/shared\/order-aggregator\.js/);

    const cssPath = path.resolve(path.dirname(page), '../shared/kitchen-display.css');
    const jsPath = path.resolve(path.dirname(page), '../shared/kitchen-display.js');
    assert.equal(fs.existsSync(cssPath), true);
    assert.equal(fs.existsSync(jsPath), true);

    if (page.startsWith('pagnottella-gourmet/')) {
      assert.equal(/bonifico/i.test(html), false);
    }
  }
  assert.equal(/bonifico/i.test(fs.readFileSync('shared/kitchen-display.js', 'utf8')), false);
});
