let DATA = null;
let PRODUCTS = [];
let CATS = [];
const state = { screen:'landing', cat:'all', filter:'', query:'', sort:'recommended', cart:{}, current:null, option:null };
const authState = { loading:false, user:null, message:'' };
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCQJsNbgaR89gF_1vLe6H4DPboOhQvm9nI",
  authDomain: "app-ordini-pranzo-alimentari.firebaseapp.com",
  projectId: "app-ordini-pranzo-alimentari",
  storageBucket: "app-ordini-pranzo-alimentari.appspot.com",
  messagingSenderId: "553169964686",
  appId: "1:553169964686:web:7f8ca6f32a301949e4c3df"
};
let firebaseAuthPromise = null;
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
const authenticatedDoseUser = () => getStoredDoseUser() || null;
const companyCopy = () => DATA?.orderContext?.company || 'DOS Design S.p.a.';
const deliverySiteCopy = () => DATA?.orderContext?.deliverySite || 'Via Arno, 52, 00198 Roma RM';
const paymentBeneficiary = () => DATA?.payment?.beneficiary || '';
const paymentIban = () => DATA?.payment?.iban || '';
const discountedPrice = v => Math.round(v * (1 - discountRate()) * 100) / 100;
const isLocalPreview = () => location.protocol === 'file:';
const setAuthButtonsDisabled = (disabled) => {
  ['authGateGoogle', 'authGateLocal'].forEach((id) => {
    const el = byId(id);
    if(el) el.disabled = !!disabled;
  });
};

async function bootstrap(){
  if(!isLocalPreview() && !authenticatedDoseUser()){
    const next = encodeURIComponent('pagnottella');
    window.location.replace(`../?next=${next}`);
    return;
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

function hydrateStatic(){
  byId('brand-subtitle').textContent = `Suite DOSepranza · ${DATA.copy.eyebrow} · ordine in pochi tap`;
  byId('heroTitle').textContent = DATA.copy.headline;
  byId('heroText').textContent = `Menu dedicato con prezzi originali e scontati sempre visibili. Ordina e paga entro le 12:00, poi consegna entro le 13:00.`;
  byId('contact-address').textContent = DATA.contact.address;
  byId('contact-hours').textContent = DATA.contact.hours;
  byId('contact-whatsapp').href = DATA.contact.whatsappUrl;
  byId('contact-site').href = DATA.contact.website;
  byId('price-validity-note').textContent = 'Ricette e prezzi soggetti a conferma del punto vendita. Lo sconto estivo viene applicato automaticamente fino al 23/08/2026.';
  byId('heroStats').innerHTML = DATA.highlights.map(h => `<span class="heroStat"><strong>${esc(h.label)}</strong> · ${esc(h.value)}</span>`).join('');
  byId('hero-highlight-list').innerHTML = DATA.highlights.map((h, idx) => `<span class="serviceChip ${idx===0?'serviceChipPrimary':''}" role="listitem">${esc(h.value)}</span>`).join('');
  byId('extrasPreview').innerHTML = DATA.extras.slice(0, 8).map(x => `<span class="extraChip">${esc(x.name)} <span>${money(x.price)}</span></span>`).join('');
  byId('extrasGrid').innerHTML = DATA.extras.map(x => `<span class="extraChip">${esc(x.name)} <span>${money(x.price)}</span></span>`).join('');
  byId('notesList').innerHTML = [
    { title:'Allergeni', body: DATA.notes.allergens },
    { title:'Prodotti', body: `${DATA.notes.frozen} ${DATA.notes.olive}` },
    { title:'Pagamento', body: paymentStatusCopy() },
  ].map(n => `<div class="noteItem"><strong>${esc(n.title)}</strong>${esc(n.body)}</div>`).join('');
  byId('paymentMethods').innerHTML = DATA.payment.methods.map(method => {
    if(typeof method === 'string') return `<span class="methodChip">${esc(method)}</span>`;
    return `<a class="methodChip methodChipLink" href="${esc(method.href)}" target="_blank" rel="noopener">${esc(method.label)}</a>`;
  }).join('');
  const paymentDetails = byId('paymentDetails');
  if(paymentDetails){
    const beneficiary = paymentBeneficiary();
    const iban = paymentIban();
    const qrImage = DATA.payment.qrImage || '';
    paymentDetails.innerHTML = `
      <div class="paymentDetailRow">
        <span class="paymentDetailLabel">Intestatario</span>
        <span class="paymentDetailValue">${esc(beneficiary)}</span>
      </div>
      <div class="paymentDetailRow">
        <span class="paymentDetailLabel">IBAN</span>
        <span class="paymentDetailValue">${esc(iban)}</span>
      </div>
      ${qrImage ? `<div class="paymentQrCard">
        <img src="${esc(qrImage)}" alt="QR code Satispay La Pagnottella Gourmet" loading="lazy">
        <div class="paymentQrBody">
          <strong>QR Satispay</strong>
          <p>Apri il QR dal checkout oppure copia l'IBAN per il bonifico. PayPal e Nexi saranno disponibili da settembre.</p>
          <div class="paymentQrActions">
            <a class="paymentActionBtn" href="${esc(qrImage)}" target="_blank" rel="noopener">Apri QR</a>
            <button type="button" class="paymentActionBtn" onclick="copyPaymentIban()">Copia IBAN</button>
          </div>
        </div>
      </div>` : ''}
    `;
  }
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
    if(el) el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', renderCart);
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
async function loadFirebaseAuth(){
  if(firebaseAuthPromise) return firebaseAuthPromise;
  firebaseAuthPromise = (async () => {
    const [{ initializeApp }, { getAuth, GoogleAuthProvider, signInWithPopup, browserLocalPersistence, setPersistence }] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js")
    ]);
    const app = initializeApp(FIREBASE_CONFIG, 'dosepranza-pagnottella');
    const auth = getAuth(app);
    await setPersistence(auth, browserLocalPersistence);
    return { auth, GoogleAuthProvider, signInWithPopup };
  })();
  return firebaseAuthPromise;
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
    const { auth, GoogleAuthProvider, signInWithPopup } = await loadFirebaseAuth();
    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    const user = result?.user;
    const payload = {
      name: user?.displayName || user?.email?.split('@')[0] || 'Utente DOS',
      email: user?.email || ''
    };
    if(payload.email){
      localStorage.setItem('dose_user', JSON.stringify(payload));
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
    name: 'Marco Tranquilli',
    email: 'marco.tranquilli@dos.design',
    source: 'local-access'
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
  const name = (byId('customer')?.value || authenticatedCustomerName() || 'Cliente').trim();
  const company = companyCopy().trim();
  const costCenter = deliverySiteCopy().trim();
  const notes = (byId('notes')?.value || '').trim();
  const now = new Date();
  const date = now.toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const time = now.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
  let msg = `Ordine ${DATA.copy.brand} - DOSepranza\nCliente: ${name}`;
  msg += `\nAzienda: ${company}`;
  msg += `\nSede di consegna: ${costCenter}`;
  msg += `\nData: ${cap(date)} - ${time}`;
  msg += `\nPunto vendita: ${DATA.contact.address}`;
  msg += `\nFinestra servizio: ${deliveryCopy()}`;
  msg += `\n\nOrdine:\n`;
  t.items.forEach(i => { msg += `${i.qty}x ${i.name} (${i.opt}) - ${money(discountedPrice(i.originalUnit)*i.qty)}\n`; });
  const rate = Math.round(discountRate() * 100);
  msg += `\nTotale: ${money(t.total)}${rate ? ` (${discountLabel()} applicato)` : ''}`;
  msg += `\nPagamento: ${DATA.payment.model}`;
  msg += `\nMetodi: ${DATA.payment.methods.map(method => typeof method === 'string' ? method : method.label).join(', ')}`;
  msg += `\nNota pagamenti: ${DATA.payment.pickup}`;
  if(paymentBeneficiary()) msg += `\nIntestatario bonifico: ${paymentBeneficiary()}`;
  if(paymentIban()) msg += `\nIBAN: ${paymentIban()}`;
  if(notes) msg += `\nNote/allergie: ${notes}`;
  msg += `\n\nOrdine effettuato tramite DOSepranza`;
  return msg;
}
function cap(s){ return s.charAt(0).toUpperCase() + s.slice(1); }
function whatsappUrl(){ const params = new URLSearchParams({ phone:DATA.whatsapp, text:buildMessage(), type:'phone_number', app_absent:'0' }); return 'https://api.whatsapp.com/send/?' + params.toString(); }
function sendWA(){ if(totals().count === 0) return; logOrder(); window.open(whatsappUrl(),'_blank'); byId('confirm').classList.add('show'); byId('confirm').textContent = 'Ordine pronto: WhatsApp è stato aperto con il riepilogo completo, incluso il promemoria di pagamento entro le 12:00.'; }
function copyPaymentIban(){
  const iban = paymentIban();
  if(!iban) return;
  navigator.clipboard?.writeText(iban).then(() => toast('IBAN copiato')).catch(() => toast(`IBAN: ${iban}`));
}
function logOrder(){ const logs = JSON.parse(localStorage.getItem(ORDER_LOG_KEY)||'[]'); const t = totals(); logs.unshift({ ts:new Date().toISOString(), customer:(byId('customer')?.value||authenticatedCustomerName()||'Cliente').trim(), company:companyCopy(), costCenter:deliverySiteCopy(), count:t.count, total:t.total, message:buildMessage() }); localStorage.setItem(ORDER_LOG_KEY, JSON.stringify(logs.slice(0,25))); updateAdmin(); }
function newOrder(){ state.cart = {}; byId('notes').value = ''; byId('confirm').classList.remove('show'); renderCart(); closeCart(); }
function openCart(){ byId('cart').classList.add('open'); byId('cartBackdrop').classList.add('show'); }
function closeCart(){ byId('cart').classList.remove('open'); byId('cartBackdrop').classList.remove('show'); }
function toast(txt){ const el = byId('toast'); el.textContent = txt; el.classList.add('show'); clearTimeout(window.__toast); window.__toast = setTimeout(() => el.classList.remove('show'), 1600); }
function updateAdmin(){
  if(!byId('mProducts')) return;
  const logs = JSON.parse(localStorage.getItem(ORDER_LOG_KEY)||'[]');
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
function exportCSV(){ const logs = JSON.parse(localStorage.getItem(ORDER_LOG_KEY)||'[]'); const rows = [['timestamp','cliente','azienda','centro_costo','prodotti','totale','messaggio'], ...logs.map(o=>[o.ts,o.customer,o.company||'',o.costCenter||'',o.count,o.total,o.message])]; const csv = rows.map(r=>r.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(',')).join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download = 'ordini-pagnottella.csv'; a.click(); URL.revokeObjectURL(a.href); }
function escJs(s){ return String(s).replace(/[\\']/g, m => m === '\\' ? '\\\\' : "\\'"); }

Object.assign(window, { openShop, backLanding, setCat, setFilter, openDetails, pickOption, closeDrawer, quickAdd, drawerAdd, changeQty, sendWA, newOrder, openCart, closeCart, exportCSV, copyPaymentIban });
bootstrap().catch(err => {
  console.error(err);
  document.body.innerHTML = `<div style="max-width:720px;margin:48px auto;padding:24px;border-radius:24px;background:#fff;border:1px solid #eadfce;font-family:Manrope,sans-serif"><h1 style="margin-top:0">Errore caricamento catalogo Pagnottella</h1><p>${esc(err.message || 'Errore sconosciuto')}</p><p>Verifica il file <code>assets/pagnottella/data/menu.json</code> e gli asset locali.</p></div>`;
});
