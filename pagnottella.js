(() => {
  const SUPPLIER = {
    id: 'pagnottella-gourmet',
    name: 'La Pagnottella Gourmet',
    whatsappNumber: '',
    orderCutoffLabel: 'da configurare',
    deliveryLabel: 'da configurare',
    paymentLabel: 'da configurare'
  };

  // Incolla qui il catalogo reale della Parte 3 quando disponibile.
  // Formato atteso: { id, name, category, price, desc, tags, icon, active }
  const PRODUCTS = [];

  const state = {
    query: '',
    category: 'Tutte',
    sort: 'featured',
    cart: []
  };

  const els = {};
  const eur = (value) => `€${Number(value || 0).toFixed(2)}`;
  const esc = (value) => String(value ?? '').replace(/[&<>"'`=\\/]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#x60;', '=': '&#x3D;', '/': '&#x2F;', '\\': '&#x5C;'
  }[c]));
  const normalize = (value) => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  function cacheEls() {
    ['search-input','sort-select','category-filters','catalog-subtitle','product-grid','empty-state','cart','cart-items','cart-count','summary-count','cart-total','customer-name','order-notes','configuration-callout','send-whatsapp','copy-order','clear-cart','mobile-bar','mobile-total','mobile-count','mobile-cart-button','status-chip']
      .forEach((id) => { els[id] = document.getElementById(id); });
  }

  function categories() {
    return ['Tutte', ...Array.from(new Set(PRODUCTS.map((p) => p.category || 'Altro'))).sort((a, b) => a.localeCompare(b, 'it'))];
  }

  function productList() {
    const q = normalize(state.query);
    let items = PRODUCTS.filter((p) => p.active !== false);
    if(state.category !== 'Tutte') items = items.filter((p) => (p.category || 'Altro') === state.category);
    if(q) {
      items = items.filter((p) => normalize(`${p.name} ${p.desc || ''} ${(p.tags || []).join(' ')}`).includes(q));
    }
    const sortable = [...items];
    if(state.sort === 'price-asc') sortable.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    if(state.sort === 'price-desc') sortable.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    if(state.sort === 'name') sortable.sort((a, b) => String(a.name).localeCompare(String(b.name), 'it'));
    return sortable;
  }

  function renderFilters() {
    els['category-filters'].innerHTML = categories().map((cat) => `
      <button class="filter ${cat === state.category ? 'active' : ''}" data-category="${esc(cat)}">${esc(cat)}</button>
    `).join('');
  }

  function renderCatalog() {
    renderFilters();
    const items = productList();
    const totalProducts = PRODUCTS.filter((p) => p.active !== false).length;
    els['catalog-subtitle'].textContent = totalProducts
      ? `${totalProducts} prodotti disponibili nel catalogo Pagnottella.`
      : 'Catalogo non ancora caricato: serve la Parte 3 con prodotti e logica originale.';

    if(!PRODUCTS.length) {
      els['product-grid'].innerHTML = '';
      els['empty-state'].classList.remove('hidden');
      els['empty-state'].innerHTML = `
        <strong>Catalogo Pagnottella in attesa dati.</strong><br>
        La struttura del nuovo fornitore è pronta. Per abilitarla servono il blocco prodotti/JavaScript della Parte 3 e il numero WhatsApp del fornitore.
      `;
      return;
    }

    if(!items.length) {
      els['product-grid'].innerHTML = '';
      els['empty-state'].classList.remove('hidden');
      els['empty-state'].textContent = 'Nessun prodotto trovato con i filtri correnti.';
      return;
    }

    els['empty-state'].classList.add('hidden');
    els['product-grid'].innerHTML = items.map((p) => `
      <article class="card">
        <div class="pic" aria-hidden="true">${esc(p.icon || '🥪')}</div>
        <div class="body">
          <div class="nameRow">
            <h4>${esc(p.name)}</h4>
            <div class="price">${eur(p.price)}</div>
          </div>
          <p class="desc">${esc(p.desc || 'Prodotto La Pagnottella Gourmet')}</p>
          <div class="tags">${(p.tags || []).map((tag) => `<span class="tag">${esc(tag)}</span>`).join('')}</div>
          <button class="add" data-add="${esc(p.id)}">Aggiungi</button>
        </div>
      </article>
    `).join('');
  }

  function cartTotal() {
    return state.cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 1), 0);
  }

  function renderCart() {
    const count = state.cart.reduce((sum, item) => sum + Number(item.qty || 1), 0);
    const total = cartTotal();
    els['cart-count'].textContent = count;
    els['summary-count'].textContent = count;
    els['cart-total'].textContent = eur(total);
    els['mobile-total'].textContent = eur(total);
    els['mobile-count'].textContent = `${count} ${count === 1 ? 'prodotto' : 'prodotti'}`;

    if(!state.cart.length) {
      els['cart-items'].innerHTML = '<div class="cartEmpty">Il carrello è vuoto. Aggiungi prodotti dal catalogo quando sarà disponibile.</div>';
    } else {
      els['cart-items'].innerHTML = state.cart.map((item) => `
        <div class="cartItem">
          <div>
            <div class="ciName">${esc(item.name)}</div>
            <div class="ciMeta">${esc(item.category || 'Catalogo')} · ${eur(item.price)} cad.</div>
            <div class="qty">
              <button data-dec="${esc(item.id)}" aria-label="Diminuisci ${esc(item.name)}">−</button>
              <strong>${item.qty}</strong>
              <button data-inc="${esc(item.id)}" aria-label="Aumenta ${esc(item.name)}">+</button>
            </div>
          </div>
          <div class="ciPrice">${eur(Number(item.price || 0) * Number(item.qty || 1))}</div>
        </div>
      `).join('');
    }

    const missing = [];
    if(!SUPPLIER.whatsappNumber) missing.push('numero WhatsApp');
    if(!PRODUCTS.length) missing.push('catalogo prodotti');
    els['configuration-callout'].innerHTML = missing.length
      ? `<strong>Configurazione incompleta</strong><span>Per rendere operativo il fornitore servono: ${missing.join(' e ')}.</span>`
      : `<strong>Ordine WhatsApp attivo</strong><span>Controlla il riepilogo prima dell’invio.</span>`;
    els['status-chip'].textContent = missing.length ? 'In configurazione' : 'Operativo';
    els['send-whatsapp'].disabled = !!missing.length || !state.cart.length;
  }

  function addToCart(id) {
    const p = PRODUCTS.find((item) => item.id === id);
    if(!p) return;
    const current = state.cart.find((item) => item.id === id);
    if(current) current.qty += 1;
    else state.cart.push({ ...p, qty: 1 });
    renderCart();
  }

  function inc(id) {
    const current = state.cart.find((item) => item.id === id);
    if(current) current.qty += 1;
    renderCart();
  }

  function dec(id) {
    const current = state.cart.find((item) => item.id === id);
    if(!current) return;
    current.qty -= 1;
    if(current.qty <= 0) state.cart = state.cart.filter((item) => item.id !== id);
    renderCart();
  }

  function orderText() {
    const name = els['customer-name'].value.trim() || 'Cliente DOSepranza';
    const notes = els['order-notes'].value.trim();
    const lines = [
      `Ordine ${SUPPLIER.name}`,
      `Cliente: ${name}`,
      '',
      ...state.cart.map((item) => `• ${item.qty}x ${item.name} — ${eur(Number(item.price || 0) * Number(item.qty || 1))}`),
      '',
      `Totale: ${eur(cartTotal())}`
    ];
    if(notes) lines.push('', `Note/allergie: ${notes}`);
    return lines.join('\n');
  }

  async function copyOrder() {
    const text = orderText();
    try {
      await navigator.clipboard.writeText(text);
      alert('Riepilogo ordine copiato.');
    } catch(e) {
      window.prompt('Copia manualmente il riepilogo:', text);
    }
  }

  function sendWhatsapp() {
    if(!SUPPLIER.whatsappNumber || !state.cart.length) return;
    const url = `https://wa.me/${SUPPLIER.whatsappNumber}?text=${encodeURIComponent(orderText())}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function bind() {
    els['search-input'].addEventListener('input', (event) => { state.query = event.target.value; renderCatalog(); });
    els['sort-select'].addEventListener('change', (event) => { state.sort = event.target.value; renderCatalog(); });
    els['category-filters'].addEventListener('click', (event) => {
      const btn = event.target.closest('[data-category]');
      if(!btn) return;
      state.category = btn.dataset.category;
      renderCatalog();
    });
    els['product-grid'].addEventListener('click', (event) => {
      const btn = event.target.closest('[data-add]');
      if(btn) addToCart(btn.dataset.add);
    });
    els['cart-items'].addEventListener('click', (event) => {
      const incBtn = event.target.closest('[data-inc]');
      const decBtn = event.target.closest('[data-dec]');
      if(incBtn) inc(incBtn.dataset.inc);
      if(decBtn) dec(decBtn.dataset.dec);
    });
    els['copy-order'].addEventListener('click', copyOrder);
    els['send-whatsapp'].addEventListener('click', sendWhatsapp);
    els['clear-cart'].addEventListener('click', () => { state.cart = []; renderCart(); });
    els['mobile-cart-button'].addEventListener('click', () => els.cart.classList.toggle('open'));
  }

  function init() {
    cacheEls();
    bind();
    renderCatalog();
    renderCart();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
