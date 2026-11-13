const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('e479185: Hub sets one-shot direct shop flag while keeping canonical href', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /href="\.\/pagnottella-gourmet\/index\.html"/);

  const scriptMatch = html.match(/<script>(document\.addEventListener\("click"[\s\S]*?)<\/script>/);
  assert.ok(scriptMatch, 'Expected inline Hub click hook script');

  const store = new Map();
  let clickHandler = null;
  const context = {
    document: {
      addEventListener(type, fn) {
        if (type === 'click') clickHandler = fn;
      }
    },
    sessionStorage: {
      setItem(k, v) { store.set(k, String(v)); },
      getItem(k) { return store.has(k) ? store.get(k) : null; },
      removeItem(k) { store.delete(k); }
    }
  };

  vm.runInNewContext(scriptMatch[1], context);
  assert.equal(typeof clickHandler, 'function');

  clickHandler({ target: { closest: () => null } });
  assert.equal(store.has('dosepranza_direct_shop'), false);

  clickHandler({ target: { closest: (sel) => (sel.includes('pagnottella') ? {} : null) } });
  assert.equal(store.get('dosepranza_direct_shop'), 'pagnottella');
});

test('e479185: pagnottella.js consumes direct-shop flag once and CSS preserves Russo card', () => {
  const pg = fs.readFileSync('pagnottella-gourmet/pagnottella.js', 'utf8');
  assert.match(pg, /sessionStorage\.getItem\('dosepranza_direct_shop'\)/);
  assert.match(pg, /sessionStorage\.removeItem\('dosepranza_direct_shop'\)/);
  assert.match(pg, /directStore === 'pagnottella'\)\s*await openShop\(false\)/);

  const editorialCss = fs.readFileSync('shared/pagnottella-editorial.css', 'utf8');
  assert.equal(editorialCss.includes('.supplierChoiceCard'), false);

  const prodCss = fs.readFileSync('pagnottella-gourmet/production.css', 'utf8');
  assert.match(prodCss, /\.russoCard\{background:linear-gradient\([^)]+\);color:#fff\}/);
});
