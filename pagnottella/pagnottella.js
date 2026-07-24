let DATA = null;
let PRODUCTS = [];
let CATS = [];
const state = { screen:'landing', cat:'all', filter:'', query:'', sort:'recommended', cart:{}, current:null, option:null, sending:false, lastSubmittedMessage:'' };
const authState = { loading:false, user:null, message:'' };
const supplierAccess = window.DoseSupplierAccess;
const byId = id => document.getElementById(id);
const money = v => '€' + (Math.round(v*100)/100).toFixed(2).replace('.', ',');
const esc = s => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const currentDate = () => new Date(window.__PAGNOTTELLA_NOW__ || Date.now());
const localDateKey = date => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const formatDate = value => value
  ? new Date(`${value}T12:00:00`).toLocaleDateString('it-IT', { day:'numeric', month:'long', year:'numeric' })
  : '';
const serviceClosures = () => DATA?.serviceUpdates?.closedDates || [];
const activeClosure = () => {
  const today = localDateKey(currentDate());
  return serviceClosures().find(item => today >= item.from && today <= item.to) || null;
};
const isOrderingClosed = () => Boolean(activeClosure());
const closureCopy = closure => {
  if(!closure) return '';
  const from = formatDate(closure.from).replace(/ 2026$/, '');
  return `${closure.location || 'Punto vendita'} chiuso dal ${from} al ${formatDate(closure.to)}. Gli ordini sono sospesi in queste date.`;
};
const discountRate = () => {
  const cfg = DATA?.discount;
  if(typeof cfg === 'number') return cfg;
  if(!cfg || typeof cfg !== 'object') return 0;
  const today = currentDate();
  const limit = cfg.activeUntil ? new Date(`${cfg.activeUntil}T23:59:59`) : null;
  return !limit || today <= limit ? Number(cfg.rate || 0) : Number(cfg.fallbackRate || 0);
};
const discountLabel = () => {
  const rate = Math.round(discountRate() * 100);
  if(!rate) return 'Prezzo standard';
  return `${DATA.discount.label || 'Sconto attivo'} -${rate}%`;
};
const ORDER_LOG_KEY = 'pg_order_logs';
const deliveryCopy = () => DATA?.copy?.delivery || 'Ordini e pagamenti entro le 12:00, consegna entro le 13:00';
const paymentStatusCopy = () => `${DATA.payment.model}. ${DATA.payment.pickup}.`;
const getStoredDoseUser = () => {
  try {
    return JSON.parse(localStorage.getItem('dose_user') || 'null');
  } catch (e) {
    return null;
  }
};
const authenticatedCustomerName = () => getStoredDoseUser()?.name?.trim() || '';
const authenticatedDoseUser = () => supplierAccess?.getStoredUser?.() || getStoredDoseUser() || null;
const companyCopy = () => DATA?.orderContext?.company || 'DOS Design S.p.a.';
const deliverySiteCopy = () => DATA?.orderContext?.deliverySite || 'Via Arno, 52, 00198 Roma RM';
const paymentBeneficiary = () => DATA?.payment?.beneficiary || '';
const paymentIban = () => DATA?.payment?.iban || '';
const paymentNoteCopy = () => 'Contanti, POS, Bonifico e Satispay disponibili. PayPal e Nexi saranno attivati da settembre.';
const discountedPrice = v => Math.round(v * (1 - discountRate()) * 100) / 100;
const isLocalPreview = () => location.protocol === 'file:';
const setAuthButtonsDisabled = (disabled) => {
  ['authGateGoogle', 'authGateLocal'].forEach((id) => {
    const el = byId(id);
    if(el) el.disabled = !!disabled;
  });
};

async function bootstrap(){
  if(!supplierAccess) throw new Error('Modulo di accesso fornitori non disponibile.');
  if(!isLocalPreview()){
    const session = await supplierAccess.resolveSession();
    if(!session){
      window.location.replace('../?next=pagnottella');
      return;
    }
    if(!session.isAdmin && !(await supplierAccess.canAccessSupplier('pagnottella', session))){
      window.location.replace('../russo/');
      return;
    }
    authState.user = session;
  }
  DATA = await loadData();
  PRODUCTS = DATA.products;
  CATS = DATA.cats;
  hydrateStatic();
  bind();
  renderTabs();
  renderFilters();
  if(ensureAuthenticated()) openShop(false);
  renderCatalog();
  renderCart();
  syncAuthGate();
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

function paymentMethodLabel(method){
  return typeof method === 'string' ? method : method?.label || '';
}

function paymentMethodMeta(label){
  const methods = {
    'Contanti': { icon:'€', description:'Pagamento alla consegna' },
    'POS': { icon:'▣', description:'Carta alla consegna' },
    'Bonifico bancario': { icon:'↗', description:'Bonifico entro le 12:00' },
    'Satispay': { icon:'S', description:'QR entro le 12:00' },
    'PayPal': { icon:'P', description:'Disponibile da settembre' },
    'Nexi': { icon:'N', description:'Disponibile da settembre' }
  };
  return methods[label] || { icon:'¤', description:'Metodo di pagamento' };
}

function renderPaymentOptions(){
  const activeMethods = (DATA.payment.methods || []).map(paymentMethodLabel).filter(Boolean);
  const futureMethods = (DATA.payment.futureMethods || []).map(method => ({
    label: paymentMethodLabel(method),
    availableFrom: method.availableFrom || 'settembre',
    enabled: method.enabled === true
  })).filter(method => method.label);
  const selectable = [
    ...activeMethods.map(label => ({ label, enabled:true })),
    ...futureMethods
  ];
  const selected = document.querySelector('input[name="paymentMethod"]:checked')?.value || activeMethods[0] || '';
  const options = byId('paymentOptions');
  if(options){
    options.innerHTML = selectable.map((method, index) => {
      const meta = paymentMethodMeta(method.label);
      const disabled = !method.enabled;
      const checked = !disabled && (method.label === selected || (!selected && index === 0));
      return `<label class="paymentOption ${disabled ? 'isDisabled' : ''}">
        <input type="radio" name="paymentMethod" value="${esc(method.label)}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
        <span class="paymentOptionIcon" aria-hidden="true">${esc(meta.icon)}</span>
        <span class="paymentOptionCopy"><strong>${esc(method.label)}</strong><small>${esc(meta.description)}</small></span>
        <span class="paymentOptionState">${disabled ? 'Prossimamente' : 'Seleziona'}</span>
      </label>`;
    }).join('');
  }
  const summary = byId('paymentMethods');
  if(summary){
    summary.innerHTML = [
      ...activeMethods.map(label => `<span class="methodChip">${esc(label)}</span>`),
      ...futureMethods.map(method => `<span class="methodChip methodChipDisabled" aria-disabled="true">${esc(method.label)} · da settembre</span>`)
    ].join('');
  }
}

function renderPaymentDetails(){
  const container = byId('paymentDetails');
  if(!container) return;
  const method = selectedPaymentMethod();
  if(method === 'Bonifico bancario'){
    container.innerHTML = `<div class="paymentInstruction">
      <strong>Bonifico bancario</strong>
      <p>Completa il pagamento entro le 12:00 e indica il tuo nome nella causale.</p>
      <div class="paymentDetailRow"><span class="paymentDetailLabel">Intestatario</span><span class="paymentDetailValue">${esc(paymentBeneficiary())}</span></div>
      <div class="paymentDetailRow"><span class="paymentDetailLabel">IBAN</span><span class="paymentDetailValue">${esc(paymentIban())}</span></div>
      <button type="button" class="paymentActionBtn" onclick="copyPaymentIban()">Copia IBAN</button>
    </div>`;
    return;
  }
  if(method === 'Satispay'){
    const qrImage = DATA.payment.qrImage || '';
    container.innerHTML = `<div class="paymentQrCard">
      <img src="${esc(qrImage)}" alt="QR code Satispay La Pagnottella Gourmet" loading="lazy">
      <div class="paymentQrBody">
        <strong>Satispay</strong>
        <p>Scansiona il QR e completa il pagamento entro le 12:00.</p>
        <div class="paymentQrActions"><a class="paymentActionBtn" href="${esc(qrImage)}" target="_blank" rel="noopener">Apri QR</a></div>
      </div>
    </div>`;
    return;
  }
  const copy = method === 'POS'
    ? 'Paga con carta al momento della consegna.'
    : 'Paga in contanti al momento della consegna.';
  container.innerHTML = `<div class="paymentInstruction compact"><strong>${esc(method)}</strong><p>${esc(copy)}</p></div>`;
}

function hydrateStatic(){
  byId('brand-subtitle').textContent = `Suite DOSepranza · ${DATA.copy.eyebrow} · ordine in pochi tap`;
  byId('heroTitle').textContent = DATA.copy.headline;
  byId('heroText').textContent = `Menu dedicato con prezzi originali e scontati sempre visibili. Ordina e paga entro le 12:00, poi consegna entro le 13:00.`;
  byId('contact-address').textContent = DATA.contact.address;
  byId('contact-hours').textContent = DATA.contact.hours;
  byId('contact-whatsapp').href = DATA.contact.whatsappUrl;
  byId('contact-site').href = DATA.contact.website;
  byId('price-validity-note').textContent = DATA.notes?.priceValidity
    || `Ricette e prezzi soggetti a conferma del punto vendita. Lo sconto estivo viene applicato automaticamente fino al ${formatDate(DATA.discount?.activeUntil)}.`;
  byId('heroStats').innerHTML = DATA.highlights.map(h => `<span class="heroStat"><strong>${esc(h.label)}</strong> · ${esc(h.value)}</span>`).join('');
  byId('hero-highlight-list').innerHTML = DATA.highlights.map((h, idx) => `<span class="serviceChip ${idx===0?'serviceChipPrimary':''}" role="listitem">${esc(h.value)}</span>`).join('');
  const extrasTitle = byId('extras-preview-title');
  if(extrasTitle) extrasTitle.textContent = `${DATA.extras.length} ingredienti disponibili`;
  byId('extrasPreview').innerHTML = `${DATA.extras.slice(0, 8).map(x => `<span class="extraChip">${esc(x.name)} <span>${money(x.price)}</span></span>`).join('')}<button type="button" class="extrasAllButton" onclick="scrollToExtras()">Vedi tutti i ${DATA.extras.length} ingredienti</button>`;
  byId('extrasGrid').innerHTML = DATA.extras.map(x => `<span class="extraChip">${esc(x.name)} <span>${money(x.price)}</span></span>`).join('');
  const contactHours = byId('contact-hours');
  if(contactHours && serviceClosures().length){
    let notice = byId('service-closure-notice');
    if(!notice){
      notice = document.createElement('p');
      notice.id = 'service-closure-notice';
      notice.className = 'serviceClosureNotice';
      contactHours.insertAdjacentElement('afterend', notice);
    }
    notice.textContent = closureCopy(serviceClosures()[0]);
    notice.classList.toggle('isActive', isOrderingClosed());
  }
  document.body.classList.toggle('serviceClosed', isOrderingClosed());
  byId('notesList').innerHTML = [
    { title:'Allergeni', body: DATA.notes.allergens },
    { title:'Prodotti', body: `${DATA.notes.frozen} ${DATA.notes.olive}` },
    { title:'Pagamento', body: paymentStatusCopy() },
  ].map(n => `<div class="noteItem"><strong>${esc(n.title)}</strong>${esc(n.body)}</div>`).join('');
  renderPaymentOptions();
  renderPaymentDetails();
  byId('cartDeliveryText').textContent = deliveryCopy();
  byId('discountLabel').textContent = discountLabel();
  byId('deliveryCardText').textContent = `${deliveryCopy()}.`;
  byId('paymentCardTitle').textContent = DATA.payment.model;
  byId('paymentCardText').textContent = `${DATA.payment.pickup}.`;
  const customerInput = byId('customer');
  const recognizedName = authenticatedCustomerName();
  if(customerInput && recognizedName){
    customerInput.value = recognizedName;
    customerInput.readOnly = true;
  }
  const allCat = CATS.find(c => c.id === 'all');
  if(allCat) byId('heroImage').src = allCat.hero;
}

function bind(){
  const googleBtn = byId('authGateGoogle');
  if(googleBtn) googleBtn.addEventListener('click', signInWithGoogleGate);
  const localBtn = byId('authGateLocal');
  if(localBtn) localBtn.addEventListener('click', activateLocalPreviewAccess);
  byId('search').addEventListener('input', e => { state.query = e.target.value.trim().toLowerCase(); renderCatalog(); });
  byId('sort').addEventListener('change', e => { state.sort = e.target.value; renderCatalog(); });
  ['customer','notes'].forEach(id => {
    const el = byId(id);
    if(el) el.addEventListener('input', () => { state.lastSubmittedMessage=''; renderCart(); });
  });
  byId('paymentOptions')?.addEventListener('change', () => {
    state.lastSubmittedMessage='';
    renderPaymentDetails();
    renderCart();
  });
  document.addEventListener('keydown', e => { if(e.key === 'Escape'){ closeDrawer(); closeCart(); } });
}

function openShop(save=true){
  if(!ensureAuthenticated()) return;
  state.screen='shop';
  sessionStorage.setItem('dosepranza_store','pagnottella');
  byId('landing').classList.add('hidden');
  byId('shop').classList.add('show');
  if(save) history.replaceState(null,'','?store=pagnottella');
  window.scrollTo({top:0,behavior:'smooth'});
}
function backLanding(){
  window.location.href = '../';
}
function renderTabs(){
  byId('tabs').innerHTML = CATS.map(c => `<button class="tab" data-cat="${c.id}" onclick="setCat('${c.id}')">${esc(c.label)}</button>`).join('');
  updateTabs();
}
function ensureAuthenticated(){
  const user = authenticatedDoseUser();
  if(user?.email && user?.name){
    authState.user = user;
    syncAuthGate();
    return true;
  }
  syncAuthGate(true);
  return false;
}
function syncAuthGate(forceLocked=false){
  const gate = byId('authGate');
  const status = byId('authGateStatus');
  const landing = byId('landing');
  const user = authenticatedDoseUser();
  authState.user = user;
  if(!gate || !status || !landing) return;
  landing.classList.toggle('isLocalPreview', isLocalPreview());
  const resolved = !!(user?.email && user?.name);
  landing.classList.toggle('authResolved', resolved);
  landing.classList.toggle('authLocked', forceLocked || !resolved);
  if(resolved){
    authState.message = '';
    status.textContent = `Riconosciuto come ${user.name} · ${user.email}`;
  }else if(authState.message){
    status.textContent = authState.message;
  }else if(isLocalPreview()){
    status.textContent = 'Accesso locale disponibile per la verifica offline del catalogo.';
  }else{
    status.textContent = authState.loading ? 'Accesso Google in corso...' : 'Nessuna sessione Google attiva.';
  }
}
async function signInWithGoogleGate(){
  if(isLocalPreview()){
    syncAuthGate(true);
    return;
  }
  authState.loading = true;
  authState.message = '';
  setAuthButtonsDisabled(true);
  syncAuthGate(true);
  try{
    const payload = await supplierAccess.signInWithGoogle();
    if(payload.email){
      authState.user = payload;
      authState.message = '';
      hydrateStatic();
      renderCart();
      syncAuthGate();
      const params = new URLSearchParams(location.search);
      if(params.get('store') === 'pagnottella') openShop(false);
    }else{
      authState.message = 'Login Google completato ma email non disponibile.';
    }
  }catch(err){
    console.warn('Pagnottella Google gate failed', err);
    const code = err?.code || '';
    if(code === 'auth/popup-closed-by-user'){
      authState.message = 'Accesso annullato: popup Google chiuso prima del completamento.';
    }else if(code === 'auth/cancelled-popup-request'){
      authState.message = 'Accesso Google già in corso in un altro popup.';
    }else if(code === 'auth/unauthorized-domain'){
      authState.message = `Dominio non autorizzato su Firebase Auth: ${location.hostname}.`;
    }else{
      authState.message = `Accesso Google non riuscito${code ? ` (${code})` : ''}. Riprova.`;
    }
  }finally{
    authState.loading = false;
    setAuthButtonsDisabled(false);
    syncAuthGate(!authenticatedDoseUser());
  }
}
function activateLocalPreviewAccess(){
  if(!isLocalPreview()) return;
  const fallbackUser = {
    uid: 'local-preview-admin',
    name: 'Marco Tranquilli',
    email: 'marco.tranquilli@dos.design',
    role: 'admin',
    isAdmin: true,
    provider: 'local-preview'
  };
  localStorage.setItem('dose_user', JSON.stringify(fallbackUser));
  authState.user = fallbackUser;
  hydrateStatic();
  renderCart();
  syncAuthGate();
  openShop(false);
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
  byId('sectionSub').textContent = isOrderingClosed()
    ? `${arr.length} prodotti consultabili · ordini temporaneamente sospesi`
    : `${arr.length} prodotti disponibili · ${rate ? `prezzi già scontati del ${rate}%` : 'prezzi standard attivi'}`;
  byId('empty').classList.toggle('show', arr.length === 0);
  byId('grid').innerHTML = arr.map(p => card(p)).join('');
}
function card(p){
  const badges = [];
  badges.push(...(p.tags || []).slice(0,2));
  const hasSpecificImage = p.imageMeta?.specific === true;
  const alt = hasSpecificImage ? p.name : `La Pagnottella Gourmet - foto specifica non disponibile per ${p.name}`;
  const addLabel = isOrderingClosed() ? 'Ordini sospesi' : `Aggiungi ${p.name}`;
  return `<article class="card ${hasSpecificImage ? '' : 'imageFallback'}"><div class="pic"><img src="${p.img}" alt="${esc(alt)}" loading="lazy"><div class="badges">${badges.map(t=>`<span class="badge">${esc(t)}</span>`).join('')}</div>${hasSpecificImage ? '' : '<span class="imageNotice">Foto specifica non disponibile</span>'}</div><div class="body"><div class="nameRow"><h4>${esc(p.name)}</h4><div class="price"><span class="old">${money(p.price)}</span>${money(discountedPrice(p.price))}</div></div><p class="desc">${esc(p.desc)}</p><div class="meta"><span class="tag">${esc(catLabel(p.cat))}</span>${(p.tags||[]).slice(0,3).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div><div class="actions"><button class="details" onclick="openDetails('${p.id}')">Dettagli</button><button class="add" aria-label="${esc(addLabel)}" onclick="quickAdd('${p.id}')" ${isOrderingClosed() ? 'disabled' : ''}>${isOrderingClosed() ? 'Chiuso' : '+'}</button></div></div></article>`;
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
function drawerAdd(){ if(addToCart(state.current, state.option || defaultOption(state.current))) closeDrawer(); }
function addToCart(p,o){
  if(isOrderingClosed()){
    toast('Punto vendita chiuso: ordini temporaneamente sospesi');
    return false;
  }
  const originalUnit = Math.round((p.price + o.extra) * 100) / 100;
  const key = p.id + '|' + o.label;
  if(!state.cart[key]) state.cart[key] = {...p,opt:o.label,optExtra:o.extra,originalUnit,qty:0};
  state.cart[key].qty++;
  state.lastSubmittedMessage='';
  toast(`${p.name} aggiunto al carrello`);
  renderCart();
  return true;
}
function changeQty(key,delta){ if(!state.cart[key]) return; state.cart[key].qty += delta; if(state.cart[key].qty <= 0) delete state.cart[key]; state.lastSubmittedMessage=''; renderCart(); }
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
  const sendButton = byId('sendOrderBtn');
  if(sendButton) sendButton.disabled = isOrderingClosed();
  const sendLabel = byId('sendOrderLabel');
  if(sendLabel && isOrderingClosed()) sendLabel.textContent = 'Ordini sospesi durante la chiusura';
  updateAdmin();
}
function scrollToExtras(){ byId('extrasGrid')?.scrollIntoView({ behavior:'smooth', block:'start' }); }
function escKey(s){ return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }
function selectedPaymentMethod(){
  const value = (document.querySelector('input[name="paymentMethod"]:checked')?.value || '').trim();
  if(value) return value;
  const first = DATA?.payment?.methods?.[0];
  return typeof first === 'string' ? first : first?.label || '';
}
function buildMessage(){
  const t = totals();
  const name = (byId('customer')?.value || authenticatedCustomerName() || 'Cliente').trim();
  const company = companyCopy().trim();
  const costCenter = deliverySiteCopy().trim();
  const notes = (byId('notes')?.value || '').trim();
  const paymentMethod = selectedPaymentMethod();
  const now = currentDate();
  const date = now.toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const time = now.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
  let msg = `📦 Riepilogo Ordine – ${DATA.copy.brand}`;
  msg += `\nOrdine tramite DOSepranza`;
  msg += `\n\n👤 Cliente`;
  msg += `\n${name} – ${company}`;
  msg += `\nConsegna: ${costCenter}`;
  msg += `\nData: ${cap(date)} - ${time}`;
  msg += `\n\n🏪 Punto Vendita`;
  msg += `\n${DATA.contact.address}`;
  msg += `\nFinestra servizio: Ordini/pagamenti entro le 12:00 · Consegna entro le 13:00`;
  msg += `\n\n🥪 Ordine`;
  t.items.forEach(i => { msg += `\n- ${i.qty}x ${i.name} (${i.opt}) — ${money(discountedPrice(i.originalUnit)*i.qty)}`; });
  const rate = Math.round(discountRate() * 100);
  msg += `\nTotale: ${money(t.total)}`;
  if(rate) msg += `\nSconti applicati: ${discountLabel()}`;
  msg += `\n\n💳 Pagamento`;
  msg += `\nMetodo selezionato: ${paymentMethod || 'Non specificato'}`;
  msg += `\nNote pagamento: ${paymentNoteCopy()}`;
  if(paymentMethod === 'Bonifico bancario'){
    if(paymentBeneficiary()) msg += `\nIntestatario: ${paymentBeneficiary()}`;
    if(paymentIban()) msg += `\nIBAN: ${paymentIban()}`;
  }
  msg += `\n\n⚠️ Note / Allergie`;
  msg += `\n${notes || 'Nessuna'}`;
  return msg;
}
function cap(s){ return s.charAt(0).toUpperCase() + s.slice(1); }
function whatsappUrl(){ const params = new URLSearchParams({ phone:DATA.whatsapp, text:buildMessage(), type:'phone_number', app_absent:'0' }); return 'https://api.whatsapp.com/send/?' + params.toString(); }
function buildOrderPayload(){
  const t = totals();
  const items = t.items.flatMap(item => Array.from({ length:item.qty }, () => ({
    id: item.id,
    name: item.name,
    cat: catLabel(item.cat),
    details: item.opt,
    option: item.opt,
    quantity: 1,
    originalPrice: item.originalUnit,
    price: discountedPrice(item.originalUnit)
  })));
  return {
    clientOrderId: window.crypto?.randomUUID?.() || `pg-${Date.now()}`,
    source: 'dosepranza-2',
    supplierId: 'pagnottella',
    supplierName: DATA.copy.brand,
    company: companyCopy(),
    deliveryAddress: deliverySiteCopy(),
    pointOfSale: DATA.contact.address,
    serviceWindow: 'Ordini/pagamenti entro le 12:00 · Consegna entro le 13:00',
    items,
    subtotalOriginal: t.orig,
    discountRate: discountRate(),
    discountAmount: t.saving,
    total: t.total,
    paymentMethod: selectedPaymentMethod(),
    paymentStatus: 'pending',
    orderStatus: 'submitted',
    orderType: 'order',
    reconciled: false,
    allergies: (byId('notes')?.value || '').trim()
  };
}
function setSendBusy(busy){
  state.sending = busy;
  const button = byId('sendOrderBtn');
  const label = byId('sendOrderLabel');
  if(button) button.disabled = busy || isOrderingClosed();
  if(label) label.textContent = busy ? 'Salvataggio ordine...' : (isOrderingClosed() ? 'Ordini sospesi durante la chiusura' : 'Salva e invia su WhatsApp');
}
async function sendWA(){
  if(totals().count === 0 || state.sending) return;
  if(isOrderingClosed()){
    byId('confirm').classList.add('show', 'isError');
    byId('confirm').textContent = closureCopy(activeClosure());
    return;
  }
  const message = buildMessage();
  if(state.lastSubmittedMessage === message){
    byId('confirm').classList.add('show');
    byId('confirm').textContent = 'Questo ordine è già stato salvato. Modifica il carrello o crea un nuovo ordine per inviarne un altro.';
    return;
  }
  const popup = window.open('about:blank', '_blank');
  if(popup) popup.opener = null;
  setSendBusy(true);
  byId('confirm').classList.remove('show', 'isError');
  try{
    const payload = buildOrderPayload();
    const result = await supplierAccess.createPagnottellaOrder(payload);
    logOrder(result.id, { firebaseSaved: !result.local });
    state.lastSubmittedMessage = message;
    const target = whatsappUrl();
    if(popup) popup.location.replace(target);
    else window.open(target, '_blank', 'noopener');
    byId('confirm').classList.add('show');
    byId('confirm').textContent = `Ordine ${result.id} salvato correttamente. WhatsApp è stato aperto con il riepilogo per il ristoratore.`;
  }catch(error){
    if(popup) popup.close();
    byId('confirm').classList.add('show', 'isError');
    byId('confirm').textContent = `Ordine non inviato: ${error?.message || 'salvataggio Firebase non riuscito'}. Riprova senza ricaricare la pagina.`;
  }finally{
    setSendBusy(false);
  }
}
function copyPaymentIban(){
  const iban = paymentIban();
  if(!iban) return;
  navigator.clipboard?.writeText(iban).then(() => toast('IBAN copiato')).catch(() => toast(`IBAN: ${iban}`));
}
function sanitizeOrderLog(entry){
  return {
    id: String(entry?.id || ''),
    ts: String(entry?.ts || ''),
    supplierId: 'pagnottella',
    customer: String(entry?.customer || ''),
    company: String(entry?.company || ''),
    costCenter: String(entry?.costCenter || ''),
    paymentMethod: String(entry?.paymentMethod || ''),
    count: Number(entry?.count || 0),
    total: Number(entry?.total || 0),
    hasNotesOrAllergies: Boolean(entry?.hasNotesOrAllergies),
    savedToFirebase: Boolean(entry?.savedToFirebase)
  };
}
function readSafeOrderLogs(){
  let raw = [];
  try{
    const parsed = JSON.parse(localStorage.getItem(ORDER_LOG_KEY) || '[]');
    raw = Array.isArray(parsed) ? parsed : [];
  }catch(error){
    raw = [];
  }
  const safeLogs = raw.map(sanitizeOrderLog).slice(0,25);
  localStorage.setItem(ORDER_LOG_KEY, JSON.stringify(safeLogs));
  return safeLogs;
}
function logOrder(orderId, payload){
  const logs = readSafeOrderLogs();
  const t = totals();
  logs.unshift(sanitizeOrderLog({
    id: orderId,
    ts: new Date().toISOString(),
    supplierId: 'pagnottella',
    customer: (byId('customer')?.value || authenticatedCustomerName() || 'Cliente').trim(),
    company: companyCopy(),
    costCenter: deliverySiteCopy(),
    paymentMethod: selectedPaymentMethod(),
    count: t.count,
    total: t.total,
    hasNotesOrAllergies: Boolean((byId('notes')?.value || '').trim()),
    savedToFirebase: Boolean(payload?.firebaseSaved)
  }));
  localStorage.setItem(ORDER_LOG_KEY, JSON.stringify(logs.slice(0,25)));
  updateAdmin();
}
function newOrder(){ state.cart = {}; state.lastSubmittedMessage=''; byId('notes').value = ''; byId('confirm').classList.remove('show', 'isError'); renderCart(); closeCart(); }
function openCart(){ byId('cart').classList.add('open'); byId('cartBackdrop').classList.add('show'); }
function closeCart(){ byId('cart').classList.remove('open'); byId('cartBackdrop').classList.remove('show'); }
function toast(txt){ const el = byId('toast'); el.textContent = txt; el.classList.add('show'); clearTimeout(window.__toast); window.__toast = setTimeout(() => el.classList.remove('show'), 1600); }
function updateAdmin(){
  const logs = readSafeOrderLogs();
  if(!byId('mProducts')) return;
  const imageMapped = PRODUCTS.filter(p => p.imageMeta?.assigned).length;
  const supplierCheck = PRODUCTS.filter(p => p.imageMeta?.needsSupplierConfirmation).length;
  const specificShots = PRODUCTS.filter(p => p.imageMeta?.specific === true).length;
  byId('mProducts').textContent = PRODUCTS.length;
  byId('mCart').textContent = totals().count;
  byId('mOrders').textContent = logs.length;
  byId('mValue').textContent = money(logs.reduce((a,o)=>a+Number(o.total||0),0));
  byId('mImageCoverage').textContent = `${imageMapped}/${PRODUCTS.length}`;
  byId('mSupplierCheck').textContent = String(supplierCheck);
  byId('mSpecificShots').textContent = String(specificShots);
}
function exportCSV(){ const logs = readSafeOrderLogs(); const rows = [['timestamp','cliente','azienda','centro_costo','metodo_pagamento','prodotti','totale','note_o_allergie','salvato_firebase'], ...logs.map(o=>[o.ts,o.customer,o.company||'',o.costCenter||'',o.paymentMethod,o.count,o.total,o.hasNotesOrAllergies,o.savedToFirebase])]; const csv = rows.map(r=>r.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(',')).join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download = 'ordini-pagnottella.csv'; a.click(); URL.revokeObjectURL(a.href); }
function escJs(s){ return String(s).replace(/[\\']/g, m => m === '\\' ? '\\\\' : "\\'"); }

Object.assign(window, { openShop, backLanding, setCat, setFilter, openDetails, pickOption, closeDrawer, quickAdd, drawerAdd, changeQty, sendWA, newOrder, openCart, closeCart, exportCSV, copyPaymentIban, scrollToExtras });
bootstrap().catch(err => {
  console.error(err);
  document.body.innerHTML = `<div style="max-width:720px;margin:48px auto;padding:24px;border-radius:24px;background:#fff;border:1px solid #eadfce;font-family:Manrope,sans-serif"><h1 style="margin-top:0">Errore caricamento catalogo Pagnottella</h1><p>${esc(err.message || 'Errore sconosciuto')}</p><p>Verifica il file <code>assets/pagnottella/data/menu.json</code> e gli asset locali.</p></div>`;
});
