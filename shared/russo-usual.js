(function (root) {
  const KEY = 'russo_last_completed_order';
  function save(uid, payload) {
    if (!uid) return;
    try { localStorage.setItem(KEY, JSON.stringify({ userId: uid, items: payload.items, notes: payload.allergies || '', summary: payload.items.map(item => item.name).join(' + '), timestamp: new Date().toISOString() })); }
    catch { console.warn('russo_usual_storage_unavailable'); }
  }
  function read(uid) {
    try { const saved = JSON.parse(localStorage.getItem(KEY)); return uid && saved?.userId === uid && Array.isArray(saved.items) && saved.items.length && Number.isFinite(Date.parse(saved.timestamp)) ? saved : null; } catch { return null; }
  }
  function plan(items, catalog) {
    const accepted = [], skipped = [];
    for (const item of items) {
      const product = catalog.find(product => String(product.id) === String(item.id));
      const qty = item.quantity ?? item.qty ?? 1;
      if (!product || product.available === false || item.details || product.sizes || product.variants || !Number.isFinite(product.price) || product.price < 0 || !Number.isInteger(qty) || qty < 1 || qty > 50) skipped.push(item.name || 'Prodotto');
      else accepted.push({ item, product, qty });
    }
    return { accepted, skipped };
  }
  function refresh() {
    const adapter = root.DoseRussoUsualCart, card = document.getElementById('russo-usual');
    if (!adapter || !card) return;
    const saved = read(adapter.uid());
    card.hidden = !saved || !adapter.empty();
    if (!card.hidden) document.getElementById('russo-usual-summary').textContent = `Il tuo solito: ${saved.summary}`;
  }
  root.DoseRussoUsual = { save, read, plan, refresh };
  if (typeof document !== 'undefined') {
    const count = document.getElementById('cart-count');
    if (count && root.MutationObserver) new root.MutationObserver(refresh).observe(count, { childList: true, characterData: true, subtree: true });
    document.getElementById('russo-usual-repeat')?.addEventListener('click', () => {
      const adapter = root.DoseRussoUsualCart, saved = read(adapter?.uid());
      if (!saved || !adapter.empty()) return;
      try {
        const result = plan(saved.items, root.DoseCustomerCatalog.list());
        if (result.accepted.length) adapter.repeat(result.accepted, saved.notes);
        document.getElementById('russo-usual-status').textContent = result.skipped.length ? `Da ricomporre dal catalogo: ${result.skipped.join(', ')}` : 'Ordine ripristinato ai prezzi attuali. Verifica e conferma.';
        refresh();
      } catch (error) { document.getElementById('russo-usual-status').textContent = error.message; }
    });
  }
})(typeof window === 'undefined' ? globalThis : window);
