const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('hub-auth.js', 'utf8');

async function boot(session, search = '', loginError = null) {
  const nodes = new Map();
  const classes = new Set();
  const redirects = [];
  let writes = 0;
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { hidden: true, handlers: {}, addEventListener(type, cb) { this.handlers[type] = cb; }, scrollIntoView() {} });
    return nodes.get(id);
  };
  const links = [node('russo-link'), node('pagnottella-link')];
  const context = vm.createContext({
    URLSearchParams, console,
    document: { getElementById: node, querySelectorAll: () => links, body: { classList: {
      remove: name => classes.delete(name), toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name)
    } } },
    window: { location: { search, replace: href => redirects.push(href) }, setTimeout: cb => cb(), DoseSupplierAccess: {
      isFilePreview: () => false, resolveSession: async () => session,
      ensureFirebase: async () => ({ auth: {}, authSdk: {
        GoogleAuthProvider: class { setCustomParameters() {} },
        signInWithPopup: async () => { if (loginError) throw loginError; }
      } }),
      getSupplierSettings: async () => ({ pagnottella: { enabledForUsers: true } }),
      setSupplierEnabled: async () => { writes++; return {}; }
    } }
  });
  vm.runInContext(source, context);
  await new Promise(resolve => setImmediate(resolve));
  return { node, links, classes, redirects, context, writes: () => writes };
}
for (const email of ['luca.pacella@dos.design', 'marta.diamantini@dos.design']) {
  test(`${email}: hub and supplier links without publishing rights`, async () => {
    const app = await boot({ email, role: 'coordinator', isAdmin: false });
    assert.deepEqual(app.redirects, []);
    assert.equal(app.node('suppliers-grid').hidden, false);
    assert.equal(app.node('coordinator-admin-link-wrapper').hidden, false);
    assert.equal(app.classes.has('is-admin'), false);
    for (const link of app.links) link.handlers.click({ preventDefault() { assert.fail('supplier blocked'); } });
    await app.node('pagnottella-enabled').handlers.change({ currentTarget: { checked: true } });
    assert.equal(app.writes(), 0);
  });
}
test('coordinator honors explicit admin and supplier next', async () => {
  const session = { email: 'luca.pacella@dos.design', role: 'coordinator' };
  assert.deepEqual((await boot(session, '?next=admin')).redirects, ['./admin/']);
  assert.deepEqual((await boot(session, '?next=russo')).redirects, ['./russo/']);
  assert.deepEqual((await boot(session, '?next=pagnottella')).redirects, ['./pagnottella/?store=pagnottella']);
});
test('Marco retains publishing control and optional admin navigation', async () => {
  const app = await boot({ email: 'marco.tranquilli@dos.design', isAdmin: true });
  assert.deepEqual(app.redirects, []);
  assert.equal(app.classes.has('is-admin'), true);
  await app.node('pagnottella-enabled').handlers.change({ currentTarget: { checked: true } });
  assert.equal(app.writes(), 1);
});
test('guest and ordinary user cannot unlock coordinator UI', async () => {
  for (const session of [null, { email: 'collega@example.com', role: 'user' }]) {
    const app = await boot(session);
    assert.equal(app.node('suppliers-grid').hidden, true);
    assert.equal(app.node('coordinator-admin-link-wrapper').hidden, true);
    let prevented = false;
    app.links[0].handlers.click({ preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
  }
});
test('clearing session hides links and grid again', async () => {
  const app = await boot({ email: 'luca.pacella@dos.design', role: 'coordinator' });
  vm.runInContext('setAuthState(null)', app.context);
  assert.equal(app.node('suppliers-grid').hidden, true);
  assert.equal(app.node('coordinator-admin-link-wrapper').hidden, true);
});
test('markup and CSS preserve separation of publishing controls', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const css = fs.readFileSync('preview-hub.css', 'utf8');
  assert.match(html, /id="supplier-control-panel" class="control-panel supplier-admin-only"/);
  assert.match(html, /class="suppliers-grid auth-locked" id="suppliers-grid" hidden/);
  assert.match(html, /id="admin-hub-link"[^>]*href="\.\/admin\/"/);
  assert.match(html, /data-target="russo" href="\.\/russo\/"/);
  assert.match(css, /#suppliers-grid\[hidden\][^{]*\{ display: none !important;/);
});

test('Pardini stays on hub with both supplier links, no office privileges', async () => {
  const session = { email: 'marco.pardini@dos.design', role: 'dos_user' };
  const app = await boot(session);
  assert.deepEqual(app.redirects, []);
  assert.equal(app.node('suppliers-grid').hidden, false);
  assert.equal(app.node('supplier-control-panel').hidden, true);
  assert.equal(app.node('coordinator-admin-link-wrapper').hidden, true);
  for (const link of app.links) link.handlers.click({ preventDefault() { assert.fail('blocked'); } });
  assert.deepEqual((await boot(session, '?next=admin')).redirects, []);
  assert.deepEqual((await boot(session, '?next=https://example.com')).redirects, []);
  assert.deepEqual((await boot(session, '?next=russo')).redirects, ['./russo/']);
});
for (const code of ['auth/popup-blocked', 'auth/popup-closed-by-user', 'auth/network-request-failed']) {
  test('popup failure resets button and displays feedback: ' + code, async () => {
    const app = await boot(null, '', { code });
    await app.node('hub-google-login').handlers.click();
    assert.equal(app.node('hub-google-login').disabled, false);
    assert.ok(app.node('hub-auth-status').textContent.length > 0);
    assert.deepEqual(app.redirects, []);
  });
}
test('untrusted admin flag does not expose publication panel', async () => {
  const app = await boot({ email: 'marco.pardini@dos.design', isAdmin: true });
  assert.equal(app.node('supplier-control-panel').hidden, true);
  assert.equal(app.node('coordinator-admin-link-wrapper').hidden, true);
});

test('embedded browser guidance is visible', async () => {
  const app = await boot(null);
  vm.runInContext("window.navigator = { userAgent: 'Slack Android; wv)' }; init()", app.context);
  await new Promise(resolve => setImmediate(resolve));
  assert.match(app.node('hub-browser-hint').textContent, /browser di sistema/);
});
