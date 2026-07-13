let DATA = null;
let PRODUCTS = [];
let CATS = [];
const state = { screen:'landing', cat:'all', filter:'', query:'', sort:'recommended', cart:{}, current:null, option:null };
const byId = id => document.getElementById(id);
const money = v => '€' + (Math.round(v*100)/100).toFixed(2).replace('.', ',');
const esc = s => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const discountRate = () => {
  const cfg = DATA?.discount;
  if(typeof cfg === 'number') return cfg;
  if(!cfg || typeof cfg !== 'object') return 0;
  const today = new Date();
  const limit = cfg.activeUntil ? new Date(`${cfg.activeUntil}T23:59:59`) : null;
  return !limit || today <= limit ? Number(cfg.rate || 0) : Number(cfg.fallbackRate || 0);
};
const discountLabel = () => {
  const rate = Math.round(discountRate() * 100);
  if(!rate) return 'Prezzo standard';
  return `${DATA.discount.label || 'Sconto attivo'} -${rate}%`;
};
const deliveryCopy = () => DATA?.copy?.delivery || 'Ordini e pagamenti entro le 12:00, consegna entro le 13:00';
const paymentStatusCopy = () => `${DATA.payment.model}. ${DATA.payment.pickup}.`;
const discountedPrice = v => Math.round(v * (1 - discountRate()) * 100) / 100;

async function bootstrap(){
  DATA = await loadData();
  PRODUCTS = DATA.products;
  CATS = DATA.cats;
  hydrateStatic();
  bind();
  renderTabs();
  renderFilters();
  const params = new URLSearchParams(location.search);
  if(params.get('store') === 'pagnottella') openShop(false);
  renderCatalog();
  renderCart();
  updateAdmin();
}

async function loadData(){
  if(location.protocol === 'file:' && window.__PAGNOTTELLA_MENU__) return window.__PAGNOTTELLA_MENU__;
  try{
    const res = await fetch('../assets/pagnottella/data/menu.json', { cache: 'no-store' });
    if(!res.ok) throw new Error(`Impossibile caricare menu.json (${res.status})`);
    return await res.json();
  }catch(err){
    if(window.__PAGNOTTELLA_MENU__) return window.__PAGNOTTELLA_MENU__;
    throw err;
  }
}

function hydrateStatic(){
  byId('brand-subtitle').textContent = `${DATA.copy.eyebrow} · ordine in pochi tap`;
  byId('heroTitle').textContent = DATA.copy.headline;
  byId('heroText').textContent = `${DATA.copy.subheadline} Prezzi originali e scontati sempre visibili. Ordina e paga entro le 12:00, poi consegna entro le 13:00.`;
  byId('contact-address').textContent = DATA.contact.address;
  byId('contact-hours').textContent = DATA.contact.hours;
  byId('contact-whatsapp').href = DATA.contact.whatsappUrl;
  byId('contact-site').href = DATA.contact.website;
  byId('price-validity-note').textContent = DATA.notes.priceValidity;
  byId('heroStats').innerHTML = DATA.highlights.map(h => `<span class="heroStat"><strong>${esc(h.label)}</strong> · ${esc(h.value)}</span>`).join('');
  byId('hero-highlight-list').innerHTML = DATA.highlights.map((h, idx) => `<span class="serviceChip ${idx===0?'serviceChipPrimary':''}" role="listitem">${esc(h.value)}</span>`).join('');
  byId('extrasPreview').innerHTML = DATA.extras.slice(0, 8).map(x => `<span class="extraChip">${esc(x.name)} <span>${money(x.price)}</span></span>`).join('');
  byId('extrasGrid').innerHTML = DATA.extras.map(x => `<span class="extraChip">${esc(x.name)} <span>${money(x.price)}</span></span>`).join('');
  byId('notesList').innerHTML = [
    { title:'Allergeni', body: DATA.notes.allergens },
    { title:'Prodotti', body: `${DATA.notes.frozen} ${DATA.notes.olive}` },
    { title:'Pagamento', body: paymentStatusCopy() },
  ].map(n => `<div class="noteItem"><strong>${esc(n.title)}</strong>${esc(n.body)}</div>`).join('');
  byId('paymentMethods').innerHTML = DATA.payment.methods.map(m => `<span class="methodChip">${esc(m)}</span>`).join('');
  byId('cartDeliveryText').textContent = deliveryCopy();
  byId('discountLabel').textContent = discountLabel();
  byId('deliveryCardText').textContent = `${deliveryCopy()}.`;
  byId('paymentCardTitle').textContent = DATA.payment.model;
  byId('paymentCardText').textContent = `${DATA.payment.pickup}.`;
  const allCat = CATS.find(c => c.id === 'all');
  if(allCat) byId('heroImage').src = allCat.hero;
}

function bind(){
  byId('search').addEventListener('input', e => { state.query = e.target.value.trim().toLowerCase(); renderCatalog(); });
  byId('sort').addEventListener('change', e => { state.sort = e.target.value; renderCatalog(); });
  ['customer','notes','company','costCenter','approver','purpose'].forEach(id => {
    const el = byId(id);
    if(el) el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', renderCart);
  });
  document.addEventListener('keydown', e => { if(e.key === 'Escape'){ closeDrawer(); closeCart(); } });
}

function openShop(save=true){
  state.screen='shop';
  sessionStorage.setItem('dosepranza_store','pagnottella');
  byId('landing').classList.add('hidden');
  byId('shop').classList.add('show');
  if(save) history.replaceState(null,'','?store=pagnottella');
  window.scrollTo({top:0,behavior:'smooth'});
}
function backLanding(){
  state.screen='landing';
  sessionStorage.removeItem('dosepranza_store');
  byId('shop').classList.remove('show');
  byId('landing').classList.remove('hidden');
  history.replaceState(null,'',location.pathname);
}
function renderTabs(){
  byId('tabs').innerHTML = CATS.map(c => `<button class="tab" data-cat="${c.id}" onclick="setCat('${c.id}')">${esc(c.label)}</button>`).join('');
  updateTabs();
}
function updateTabs(){ document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.cat === state.cat)); }
function renderFilters(){
  const filters=['Top','Vegetariano','Senza frutta secca','Fresco','Proteico','Leggero','Panino','Insalata','Bevanda','Dessert'];
  byId('filters').innerHTML = filters.map(f => `<button class="filter" data-filter="${f}" onclick="setFilter('${escJs(f)}')">${esc(f)}</button>`).join('');
  updateFilters();
}
function updateFilters(){ document.querySelectorAll('.filter').forEach(b => b.classList.toggle('active', b.dataset.filter === state.filter)); }
function setCat(cat){
  state.cat = cat;
  updateTabs();
  const c = CATS.find(x => x.id === cat);
  if(c) byId('heroImage').src = c.hero;
  byId('heroKicker').textContent = cat === 'all' ? 'Menu completo' : c.label;
  renderCatalog();
  byId('catalogTop').scrollIntoView({behavior:'smooth', block:'start'});
}
function setFilter(filter){ state.filter = state.filter === filter ? '' : filter; updateFilters(); renderCatalog(); }
function catLabel(id){ return (CATS.find(c => c.id === id) || {}).label || id; }
function isSalad(p){ return p.cat.startsWith('insalate') || p.tags.includes('Insalata'); }
function optionList(p){
  if(isSalad(p)) return DATA.bases;
  if(p.cat.startsWith('panini')) return DATA.bread;
  return [{label:'Standard',extra:0}];
}
function defaultOption(p){ return optionList(p)[0]; }
function filtered(){
  let arr = PRODUCTS.filter(p => {
    const searchable = `${p.name} ${p.desc} ${(p.tags||[]).join(' ')} ${catLabel(p.cat)}`.toLowerCase();
    const noNuts = !/(noci|pinoli|pistacchio|anacardi|sesamo)/i.test(p.desc);
    const passFilter = !state.filter || (state.filter === 'Senza frutta secca' ? noNuts : (p.tags || []).includes(state.filter));
    return (state.cat === 'all' || p.cat === state.cat) && passFilter && (!state.query || searchable.includes(state.query));
  });
  if(state.sort === 'price') arr.sort((a,b)=>a.price-b.price || a.name.localeCompare(b.name));
  if(state.sort === 'az') arr.sort((a,b)=>a.name.localeCompare(b.name));
  if(state.sort === 'top') arr.sort((a,b)=>Number((b.tags||[]).includes('Top'))-Number((a.tags||[]).includes('Top')) || a.name.localeCompare(b.name));
  return arr;
}
function renderCatalog(){
  const arr = filtered();
  const cat = CATS.find(c => c.id === state.cat);
  byId('sectionTitle').textContent = state.cat === 'all' ? 'Tutto il menu' : cat.label;
  const rate = Math.round(discountRate() * 100);
  byId('sectionSub').textContent = `${arr.length} prodotti disponibili · ${rate ? `prezzi già scontati del ${rate}%` : 'prezzi standard attivi'}`;
  byId('empty').classList.toggle('show', arr.length === 0);
  byId('grid').innerHTML = arr.map(p => card(p)).join('');
}
function card(p){
  const badges = [];
  badges.push(...(p.tags || []).slice(0,2));
  return `<article class="card"><div class="pic"><img src="${p.img}" alt="${esc(p.name)}" loading="lazy"><div class="badges">${badges.map(t=>`<span class="badge">${esc(t)}</span>`).join('')}</div></div><div class="body"><div class="nameRow"><h4>${esc(p.name)}</h4><div class="price"><span class="old">${money(p.price)}</span>${money(discountedPrice(p.price))}</div></div><p class="desc">${esc(p.desc)}</p><div class="meta"><span class="tag">${esc(catLabel(p.cat))}</span>${(p.tags||[]).slice(0,3).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div><div class="actions"><button class="details" onclick="openDetails('${p.id}')">Dettagli</button><button class="add" aria-label="Aggiungi ${esc(p.name)}" onclick="quickAdd('${p.id}')">+</button></div></div></article>`;
}
function openDetails(id){
  const p = PRODUCTS.find(x => x.id === id);
  state.current = p;
  state.option = defaultOption(p);
  byId('drawerImg').src = p.img;
  byId('drawerImg').alt = p.name;
  byId('drawerName').textContent = p.name;
  byId('drawerDesc').textContent = p.desc;
  byId('drawerTags').innerHTML = (p.tags || []).map(t=>`<span class="tag">${esc(t)}</span>`).join('');
  byId('optionTitle').textContent = isSalad(p) ? 'Scegli la base dell’insalata' : (p.cat.startsWith('panini') ? 'Scegli il tipo di pane' : 'Configurazione');
  byId('optionHelp').textContent = isSalad(p) ? 'Il riso venere aggiunge +€1,50 prima dello sconto.' : (p.cat.startsWith('panini') ? 'Il pane integrale ai cereali aggiunge +€0,50 prima dello sconto.' : 'Per questa voce non sono previste varianti di base.');
  byId('options').innerHTML = optionList(p).map((o,i)=>`<button class="opt ${i===0?'on':''}" onclick="pickOption(${i})">${esc(o.label)}${o.extra?` +${money(o.extra)}`:''}</button>`).join('');
  updateDrawerPrice();
  byId('drawer').classList.add('show');
}
function pickOption(i){ state.option = optionList(state.current)[i]; document.querySelectorAll('.opt').forEach((b,idx)=>b.classList.toggle('on', idx===i)); updateDrawerPrice(); }
function updateDrawerPrice(){ const p = state.current, o = state.option || defaultOption(p); byId('drawerOld').textContent = money(p.price + o.extra); byId('drawerPrice').textContent = money(discountedPrice(p.price + o.extra)); }
function closeDrawer(){ byId('drawer').classList.remove('show'); }
function quickAdd(id){ const p = PRODUCTS.find(x => x.id === id); addToCart(p, defaultOption(p)); }
function drawerAdd(){ addToCart(state.current, state.option || defaultOption(state.current)); closeDrawer(); }
function addToCart(p,o){ const originalUnit = Math.round((p.price + o.extra) * 100) / 100; const key = p.id + '|' + o.label; if(!state.cart[key]) state.cart[key] = {...p,opt:o.label,optExtra:o.extra,originalUnit,qty:0}; state.cart[key].qty++; toast(`${p.name} aggiunto al carrello`); renderCart(); }
function changeQty(key,delta){ if(!state.cart[key]) return; state.cart[key].qty += delta; if(state.cart[key].qty <= 0) delete state.cart[key]; renderCart(); }
function totals(){ const items = Object.values(state.cart); const orig = items.reduce((a,i)=>a+i.originalUnit*i.qty,0); const total = discountedPrice(orig); return {items, count:items.reduce((a,i)=>a+i.qty,0), orig, total, saving:orig-total}; }
function renderCart(){
  const t = totals();
  byId('cartCount').textContent = t.count;
  byId('mobileCount').textContent = t.count;
  byId('mobileTotal').textContent = money(t.total);
  byId('mobileBar').classList.toggle('hidden', t.count === 0);
  const lines = t.items.map(i => `<div class="cartItem checkoutItem"><img src="${i.img}" alt="${esc(i.name)}"><div class="ciMain"><div class="ciName">${esc(i.name)}</div><div class="ciMeta">${esc(i.opt)}${i.optExtra?` · supplemento ${money(i.optExtra)}`:''}<br>${money(discountedPrice(i.originalUnit))} cad.</div><div class="qty stepper"><button aria-label="Diminuisci" onclick="changeQty('${escKey(i.id+'|'+i.opt)}',-1)">−</button><b>${i.qty}</b><button aria-label="Aumenta" onclick="changeQty('${escKey(i.id+'|'+i.opt)}',1)">+</button></div></div><div class="ciPrice">${money(discountedPrice(i.originalUnit)*i.qty)}</div></div>`).join('');
  byId('cartItems').innerHTML = t.count ? lines : `<div class="cartEmpty">Il carrello è vuoto. Aggiungi panini, insalate o bevande dal catalogo.</div>`;
  byId('summary').classList.toggle('hidden', !t.count);
  byId('checkout').classList.toggle('hidden', !t.count);
  byId('origTotal').textContent = money(t.orig);
  byId('saving').textContent = '-' + money(t.saving);
  byId('finalTotal').textContent = money(t.total);
  byId('waPreview').textContent = buildMessage();
  updateAdmin();
}
function escKey(s){ return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }
function buildMessage(){
  const t = totals();
  const name = (byId('customer')?.value || 'Cliente').trim();
  const company = (byId('company')?.value || '').trim();
  const costCenter = (byId('costCenter')?.value || '').trim();
  const approver = (byId('approver')?.value || '').trim();
  const purpose = (byId('purpose')?.value || '').trim();
  const notes = (byId('notes')?.value || '').trim();
  const now = new Date();
  const date = now.toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const time = now.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
  let msg = `Ordine ${DATA.copy.brand} - DOSepranza\nCliente: ${name}`;
  if(company) msg += `\nAzienda: ${company}`;
  if(costCenter) msg += `\nCentro di costo: ${costCenter}`;
  if(approver) msg += `\nReferente: ${approver}`;
  if(purpose) msg += `\nTipo ordine: ${purpose}`;
  msg += `\nData: ${cap(date)} - ${time}`;
  msg += `\nPunto vendita: ${DATA.contact.address}`;
  msg += `\nFinestra servizio: ${deliveryCopy()}`;
  msg += `\n\nOrdine:\n`;
  t.items.forEach(i => { msg += `${i.qty}x ${i.name} (${i.opt}) - ${money(discountedPrice(i.originalUnit)*i.qty)}\n`; });
  const rate = Math.round(discountRate() * 100);
  msg += `\nTotale: ${money(t.total)}${rate ? ` (${discountLabel()} applicato)` : ''}`;
  msg += `\nPagamento: ${DATA.payment.model}`;
  msg += `\nMetodi: ${DATA.payment.methods.join(', ')}`;
  msg += `\nNota pagamenti: ${DATA.payment.pickup}`;
  if(notes) msg += `\nNote/allergie: ${notes}`;
  msg += `\n\nOrdine effettuato tramite DOSepranza`;
  return msg;
}
function cap(s){ return s.charAt(0).toUpperCase() + s.slice(1); }
function whatsappUrl(){ const params = new URLSearchParams({ phone:DATA.whatsapp, text:buildMessage(), type:'phone_number', app_absent:'0' }); return 'https://api.whatsapp.com/send/?' + params.toString(); }
function sendWA(){ if(totals().count === 0) return; logOrder(); window.open(whatsappUrl(),'_blank'); byId('confirm').classList.add('show'); byId('confirm').textContent = 'Ordine pronto: WhatsApp è stato aperto con il riepilogo completo, incluso il promemoria di pagamento entro le 12:00.'; }
function logOrder(){ const logs = JSON.parse(localStorage.getItem('pg_demo_orders')||'[]'); const t = totals(); logs.unshift({ ts:new Date().toISOString(), customer:(byId('customer').value||'Cliente').trim(), company:(byId('company')?.value||'').trim(), costCenter:(byId('costCenter')?.value||'').trim(), count:t.count, total:t.total, message:buildMessage() }); localStorage.setItem('pg_demo_orders', JSON.stringify(logs.slice(0,25))); updateAdmin(); }
function newOrder(){ state.cart = {}; byId('notes').value = ''; byId('confirm').classList.remove('show'); renderCart(); closeCart(); }
function openCart(){ byId('cart').classList.add('open'); byId('cartBackdrop').classList.add('show'); }
function closeCart(){ byId('cart').classList.remove('open'); byId('cartBackdrop').classList.remove('show'); }
function toast(txt){ const el = byId('toast'); el.textContent = txt; el.classList.add('show'); clearTimeout(window.__toast); window.__toast = setTimeout(() => el.classList.remove('show'), 1600); }
function updateAdmin(){
  const logs = JSON.parse(localStorage.getItem('pg_demo_orders')||'[]');
  const imageMapped = PRODUCTS.filter(p => p.imageMeta?.assigned).length;
  const supplierCheck = PRODUCTS.filter(p => p.imageMeta?.needsSupplierConfirmation).length;
  const specificShots = PRODUCTS.filter(p => p.imageMeta?.mappingType === 'foto_specifica_o_quasi_specifica').length;
  byId('mProducts').textContent = PRODUCTS.length;
  byId('mCart').textContent = totals().count;
  byId('mOrders').textContent = logs.length;
  byId('mValue').textContent = money(logs.reduce((a,o)=>a+Number(o.total||0),0));
  byId('mImageCoverage').textContent = `${imageMapped}/${PRODUCTS.length}`;
  byId('mSupplierCheck').textContent = String(supplierCheck);
  byId('mSpecificShots').textContent = String(specificShots);
}
function exportCSV(){ const logs = JSON.parse(localStorage.getItem('pg_demo_orders')||'[]'); const rows = [['timestamp','cliente','azienda','centro_costo','prodotti','totale','messaggio'], ...logs.map(o=>[o.ts,o.customer,o.company||'',o.costCenter||'',o.count,o.total,o.message])]; const csv = rows.map(r=>r.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(',')).join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download = 'ordini-pagnottella-demo.csv'; a.click(); URL.revokeObjectURL(a.href); }
function escJs(s){ return String(s).replace(/[\\']/g, m => m === '\\' ? '\\\\' : "\\'"); }

Object.assign(window, { openShop, backLanding, setCat, setFilter, openDetails, pickOption, closeDrawer, quickAdd, drawerAdd, changeQty, sendWA, newOrder, openCart, closeCart, exportCSV });
bootstrap().catch(err => {
  console.error(err);
  document.body.innerHTML = `<div style="max-width:720px;margin:48px auto;padding:24px;border-radius:24px;background:#fff;border:1px solid #eadfce;font-family:Manrope,sans-serif"><h1 style="margin-top:0">Errore caricamento preview Pagnottella</h1><p>${esc(err.message || 'Errore sconosciuto')}</p><p>Verifica il file <code>assets/pagnottella/data/menu.json</code> e gli asset locali.</p></div>`;
});
