(() => {
  const SUPPLIER = {
    id: 'pagnottella-gourmet',
    name: 'La Pagnottella Gourmet',
    whatsappNumber: '393478836015',
    orderCutoffLabel: 'Pranzo 12:00 - 15:00',
    deliveryLabel: 'Consegna gratuita promo DOSepranza',
    paymentLabel: 'Pagamento alla consegna, POS o Ticket'
  };
  const DISCOUNT_RATE = 0.10;

  // Catalogo demo fornito dall'utente. La birra artigianale e' stata esclusa: richiede un flusso dedicato di verifica eta/compliance.
  const PRODUCTS = [
    { id:'pg-1', name:'Il Nettuno', category:'Panini Gourmet', price:9.50, oldPrice:11.00, desc:'Tonno rosso fresco scottato, stracciatella di bufala pugliese, granella di pistacchi di Bronte, rucola selvatica e maionese artigianale al limone.', tags:['Bestseller','Pesce Fresco'], icon:'🌊', badge:'Consigliato' },
    { id:'pg-2', name:'Il Sannita', category:'Panini Gourmet', price:8.50, desc:'Prosciutto crudo di Parma DOP 24 mesi, burrata intera, pomodori secchi sott\'olio, basilico fresco e olio extravergine monocultivar.', tags:['Tradizione','DOP'], icon:'🥪' },
    { id:'pg-3', name:'Il Vulcano', category:'Panini Gourmet', price:9.00, desc:'Spianata calabra piccante, nduja di Spilinga fondente, provola affumicata di Agerola alla piastra, melanzane grigliate e salsa hot core.', tags:['Piccante','Calabria'], icon:'🌋', badge:'Hot' },
    { id:'pg-4', name:'L\'Orto Fiorito', category:'Panini Gourmet', price:7.50, oldPrice:8.50, desc:'Zucchine e melanzane alla scapece, crema di ceci al rosmarino, pomodorini confit, cime di rapa saltate e scaglie di mandorle tostate.', tags:['Vegan','Healthy'], icon:'🌱', badge:'Light' },
    { id:'pg-5', name:'Il Tartufo Reale', category:'Panini Gourmet', price:11.50, oldPrice:13.00, desc:'Carpaccio di vitello cotto a bassa temperatura, crema al tartufo nero pregiato, funghi porcini trifolati e parmigiano reggiano 36 mesi.', tags:['Premium','Presidio Slow Food'], icon:'👑', badge:'Edizione Limitata' },
    { id:'pg-6', name:'Crudo e Oro', category:'Panini Classic', price:6.50, desc:'Prosciutto crudo nostrano, mozzarella di bufala campana e pomodoro ramato a fette.', tags:['Classico'], icon:'🥖' },
    { id:'pg-7', name:'Cotto Semplice', category:'Panini Classic', price:5.50, desc:'Prosciutto cotto alta qualita, fontina d\'Aosta valdostana DOP e funghi sott\'olio.', tags:['Classico'], icon:'🥪' },
    { id:'pg-8', name:'Vesuviana', category:'Insalatone', price:8.50, desc:'Rucola e iceberg, bocconcini di bufala, pomodori secchi, olive taggiasche e crostini artigianali al timo.', tags:['Vegetariano','Fresco'], icon:'🥗' },
    { id:'pg-9', name:'La Caesar Executive', category:'Insalatone', price:9.50, oldPrice:10.50, desc:'Petto di pollo ruspante grigliato, lattuga romana, scaglie di grana padano, salsa caesar della casa e pane fritto dorato.', tags:['Ricca','Proteica'], icon:'🥗', badge:'Popolare' },
    { id:'pg-10', name:'Patatine Rustiche', category:'Sfizi & Bevande', price:3.50, desc:'Patate olandesi fritte al momento con la buccia, servite con maionese e ketchup.', tags:['Fritto'], icon:'🍟' },
    { id:'pg-12', name:'Coca Cola Zero Lattina', category:'Sfizi & Bevande', price:2.50, desc:'Classica bevanda rinfrescante senza zuccheri in lattina di alluminio.', tags:['Analcolico'], icon:'🥤' }
  ];

  const state = { query:'', category:'Tutte', sort:'featured', cart:[] };
  const els = {};
  const eur = (value) => `€${Number(value || 0).toFixed(2)}`;
  const esc = (value) => String(value ?? '').replace(/[&<>"'`=\\/]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#x60;','=':'&#x3D;','/':'&#x2F;','\\':'&#x5C;'}[c]));
  const normalize = (value) => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  function cacheEls(){
    ['search-input','sort-select','category-filters','catalog-subtitle','product-grid','empty-state','cart','cart-items','cart-count','summary-count','cart-total','customer-name','order-notes','configuration-callout','send-whatsapp','copy-order','clear-cart','mobile-bar','mobile-total','mobile-count','mobile-cart-button','status-chip'].forEach(id => { els[id] = document.getElementById(id); });
  }
  function categories(){ return ['Tutte', ...Array.from(new Set(PRODUCTS.map(p => p.category || 'Altro'))).sort((a,b)=>a.localeCompare(b,'it'))]; }
  function productList(){
    const q = normalize(state.query);
    let items = PRODUCTS.filter(p => p.active !== false);
    if(state.category !== 'Tutte') items = items.filter(p => (p.category || 'Altro') === state.category);
    if(q) items = items.filter(p => normalize(`${p.name} ${p.desc || ''} ${(p.tags || []).join(' ')}`).includes(q));
    const sortable = [...items];
    if(state.sort === 'price-asc') sortable.sort((a,b)=>Number(a.price || 0)-Number(b.price || 0));
    if(state.sort === 'price-desc') sortable.sort((a,b)=>Number(b.price || 0)-Number(a.price || 0));
    if(state.sort === 'name') sortable.sort((a,b)=>String(a.name).localeCompare(String(b.name),'it'));
    return sortable;
  }
  function renderFilters(){
    els['category-filters'].innerHTML = categories().map(cat => `<button class="filter ${cat === state.category ? 'active' : ''}" data-category="${esc(cat)}">${esc(cat)}</button>`).join('');
  }
  function renderCatalog(){
    renderFilters();
    const items = productList();
    els['catalog-subtitle'].textContent = `${PRODUCTS.length} prodotti disponibili · sconto convenzione 10% applicato al checkout.`;
    if(!items.length){
      els['product-grid'].innerHTML = '';
      els['empty-state'].classList.remove('hidden');
      els['empty-state'].textContent = 'Nessun prodotto trovato con i filtri correnti.';
      return;
    }
    els['empty-state'].classList.add('hidden');
    els['product-grid'].innerHTML = items.map(p => `
      <article class="card">
        <div class="pic" aria-hidden="true">${esc(p.icon || '🥪')}</div>
        <div class="body">
          <div class="nameRow"><h4>${esc(p.name)}</h4><div class="price">${p.oldPrice ? `<span style="display:block;color:#8C8A84;text-decoration:line-through;font-weight:600;font-size:11px">${eur(p.oldPrice)}</span>` : ''}${eur(p.price)}</div></div>
          <p class="desc">${esc(p.desc || 'Prodotto La Pagnottella Gourmet')}</p>
          <div class="tags">${[p.badge, ...(p.tags || [])].filter(Boolean).map(tag => `<span class="tag">${esc(tag)}</span>`).join('')}</div>
          <button class="add" data-add="${esc(p.id)}">Aggiungi</button>
        </div>
      </article>`).join('');
  }
  function subtotal(){ return state.cart.reduce((sum,item)=>sum + Number(item.price || 0) * Number(item.qty || 1), 0); }
  function discount(){ return subtotal() * DISCOUNT_RATE; }
  function cartTotal(){ return subtotal() - discount(); }
  function itemCount(){ return state.cart.reduce((sum,item)=>sum + Number(item.qty || 1), 0); }
  function renderCart(){
    const count = itemCount();
    const total = cartTotal();
    els['cart-count'].textContent = count;
    els['summary-count'].textContent = `${count} prodotti · sconto ${eur(discount())}`;
    els['cart-total'].textContent = eur(total);
    els['mobile-total'].textContent = eur(total);
    els['mobile-count'].textContent = `${count} ${count === 1 ? 'prodotto' : 'prodotti'}`;
    if(!state.cart.length){
      els['cart-items'].innerHTML = '<div class="cartEmpty">Il carrello è vuoto. Aggiungi prodotti dal catalogo Pagnottella.</div>';
    } else {
      els['cart-items'].innerHTML = state.cart.map(item => `<div class="cartItem"><div><div class="ciName">${esc(item.name)}</div><div class="ciMeta">${esc(item.category || 'Catalogo')} · ${eur(item.price)} cad.</div><div class="qty"><button data-dec="${esc(item.id)}" aria-label="Diminuisci ${esc(item.name)}">−</button><strong>${item.qty}</strong><button data-inc="${esc(item.id)}" aria-label="Aumenta ${esc(item.name)}">+</button></div></div><div class="ciPrice">${eur(Number(item.price || 0) * Number(item.qty || 1))}</div></div>`).join('');
    }
    els['configuration-callout'].innerHTML = `<strong>${esc(SUPPLIER.deliveryLabel)}</strong><span>${esc(SUPPLIER.paymentLabel)}. Sconto convenzione 10% applicato automaticamente.</span>`;
    els['status-chip'].textContent = 'Operativo demo';
    els['send-whatsapp'].disabled = !state.cart.length;
  }
  function addToCart(id){ const p = PRODUCTS.find(item => item.id === id); if(!p) return; const current = state.cart.find(item => item.id === id); if(current) current.qty += 1; else state.cart.push({ ...p, qty:1 }); renderCart(); }
  function inc(id){ const current = state.cart.find(item => item.id === id); if(current) current.qty += 1; renderCart(); }
  function dec(id){ const current = state.cart.find(item => item.id === id); if(!current) return; current.qty -= 1; if(current.qty <= 0) state.cart = state.cart.filter(item => item.id !== id); renderCart(); }
  function orderText(){
    const name = els['customer-name'].value.trim() || 'Cliente DOSepranza';
    const notes = els['order-notes'].value.trim();
    const lines = [`RICEVUTA ORDINE DOSepranza`, `Fornitore: ${SUPPLIER.name}`, `Cliente: ${name}`, '', ...state.cart.map(item => `${item.qty}x ${item.name} (${eur(item.price)} cad.)`), '', `Subtotale: ${eur(subtotal())}`, `Sconto Convenzione (10%): -${eur(discount())}`, `Consegna: GRATUITA`, `TOTALE DA PAGARE: ${eur(cartTotal())}`];
    if(notes) lines.push('', `Note/allergie: ${notes}`);
    return lines.join('\n');
  }
  async function copyOrder(){ const text = orderText(); try { await navigator.clipboard.writeText(text); alert('Riepilogo ordine copiato.'); } catch(e) { window.prompt('Copia manualmente il riepilogo:', text); } }
  function sendWhatsapp(){ if(!state.cart.length) return; const url = `https://api.whatsapp.com/send?phone=${SUPPLIER.whatsappNumber}&text=${encodeURIComponent(orderText())}`; window.open(url, '_blank', 'noopener,noreferrer'); }
  function bind(){
    els['search-input'].addEventListener('input', e => { state.query = e.target.value; renderCatalog(); });
    els['sort-select'].addEventListener('change', e => { state.sort = e.target.value; renderCatalog(); });
    els['category-filters'].addEventListener('click', e => { const btn = e.target.closest('[data-category]'); if(!btn) return; state.category = btn.dataset.category; renderCatalog(); });
    els['product-grid'].addEventListener('click', e => { const btn = e.target.closest('[data-add]'); if(btn) addToCart(btn.dataset.add); });
    els['cart-items'].addEventListener('click', e => { const incBtn = e.target.closest('[data-inc]'); const decBtn = e.target.closest('[data-dec]'); if(incBtn) inc(incBtn.dataset.inc); if(decBtn) dec(decBtn.dataset.dec); });
    els['copy-order'].addEventListener('click', copyOrder);
    els['send-whatsapp'].addEventListener('click', sendWhatsapp);
    els['clear-cart'].addEventListener('click', () => { state.cart = []; renderCart(); });
    els['mobile-cart-button'].addEventListener('click', () => els.cart.classList.toggle('open'));
  }
  function init(){ cacheEls(); bind(); renderCatalog(); renderCart(); }
  document.addEventListener('DOMContentLoaded', init);
})();
