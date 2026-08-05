(() => {
  const ADMIN_EMAIL = 'marco.tranquilli@dos.design';
  const SUPPLIER_EMAILS = Object.freeze([
    'commerciale@lapagnottellagourmet.it',
    'isidorovagnozzi@gmail.com'
  ]);
  const byId = id => document.getElementById(id);
  const money = value => `€${Number(value || 0).toFixed(2).replace('.', ',')}`;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
  }[char]));
  let orders = [];
  let unsubscribe = null;
  let firestore = null;

  function session() {
    return window.DoseSupplierAccess?.getStoredUser?.() || null;
  }
  function normalizedEmail() {
    return String(session()?.email || '').trim().toLowerCase();
  }
  function isAdmin() {
    return normalizedEmail() === ADMIN_EMAIL;
  }
  function isSupplier() {
    return SUPPLIER_EMAILS.includes(normalizedEmail()) && session()?.role === 'supplier';
  }
  function hasOrderAccess() {
    return isAdmin() || isSupplier();
  }
  function toDate(value) {
    if (typeof value?.toDate === 'function') return value.toDate();
    const date = new Date(value || 0);
    return Number.isNaN(date.getTime()) ? new Date(0) : date;
  }
  function localDay(value) {
    const date = toDate(value);
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }
  function todayKey() {
    return localDay(new Date());
  }
  function supplierLabel(order) {
    if (order.supplierId === 'pagnottella') return 'La Pagnottella Gourmet';
    if (order.supplierId === 'russo') return 'Alimentari Russo';
    return 'Ordine legacy non classificato';
  }
  function selectedSupplier() {
    if (!isAdmin()) return 'pagnottella';
    return byId('adminSupplierFilter')?.value || 'all';
  }
  function scopedOrders() {
    const supplier = selectedSupplier();
    return supplier === 'all' ? orders : orders.filter(order => {
      if (supplier === 'russo') return order.supplierId === 'russo';
      return order.supplierId === supplier;
    });
  }
  function todayOrders() {
    return scopedOrders().filter(order => localDay(order.createdAt) === todayKey());
  }
  function orderStatus(order) {
    if (order.reconciled) return 'Riconciliato';
    if (order.paymentStatus === 'declared_paid') return 'Dichiarato pagato';
    return 'Da verificare';
  }
  function statusClass(order) {
    return order.reconciled ? 'isReconciled' : order.paymentStatus === 'declared_paid' ? 'isDeclared' : 'isPending';
  }
  function itemCopy(item) {
    const extras = (item.extras || []).map(extra => `${extra.name} (+${money(extra.price)})`).join(', ');
    return `${item.name} — ${item.option || item.details || 'Standard'}${extras ? ` · Extra: ${extras}` : ''}`;
  }
  function orderItems(order) {
    return (order.items || []).map(itemCopy);
  }
  function metrics(values) {
    const revenue = values.reduce((sum, order) => sum + Number(order.total || 0), 0);
    return {
      count: values.length,
      revenue,
      average: values.length ? revenue / values.length : 0,
      pending: values.filter(order => !order.reconciled).reduce((sum, order) => sum + Number(order.total || 0), 0)
    };
  }
  function setLoadError(message) {
    const list = byId('adminOrdersList');
    if (list) list.innerHTML = `<div class="adminEmpty">${escapeHtml(message)}</div>`;
  }
  function renderIdentity() {
    const user = session();
    byId('adminIdentity').textContent = `${user?.email || ''} · ${isAdmin() ? 'admin' : 'fornitore'}`;
    byId('adminAccessCopy').textContent = isAdmin()
      ? 'Accesso globale: ordini, analytics, export e riconciliazione.'
      : 'Accesso fornitore: sono caricati esclusivamente gli ordini La Pagnottella Gourmet.';
  }
  function renderOrders() {
    const values = todayOrders();
    const summary = metrics(values);
    byId('adminOrdersCount').textContent = String(summary.count);
    byId('adminRevenue').textContent = money(summary.revenue);
    byId('adminAverage').textContent = money(summary.average);
    byId('adminPending').textContent = money(summary.pending);
    byId('adminOrdersList').innerHTML = values.length ? values.map(order => `
      <article class="adminOrderCard" data-order-id="${escapeHtml(order.id)}">
        <header><div><strong>${escapeHtml(order.user || 'Cliente')}</strong><span>${toDate(order.createdAt).toLocaleTimeString('it-IT', {hour:'2-digit', minute:'2-digit'})} · ${escapeHtml(supplierLabel(order))}</span></div><span class="orderStatus ${statusClass(order)}">${orderStatus(order)}</span></header>
        <ul>${orderItems(order).map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
        <footer><span>${escapeHtml(order.paymentMethod || 'Metodo non indicato')}</span><strong>${money(order.total)}</strong>${order.reconciled || !isAdmin() ? '' : `<button type="button" onclick="reconcilePagnottellaOrder('${escapeHtml(order.id)}')">Segna riconciliato</button>`}</footer>
      </article>`).join('') : '<div class="adminEmpty">Nessun ordine registrato oggi.</div>';
  }
  function periodOrders() {
    const period = byId('analysisPeriod')?.value || 'today';
    const values = scopedOrders();
    if (period === 'all') return values;
    const days = period === '30' ? 30 : period === '7' ? 7 : 1;
    const threshold = Date.now() - days * 86400000;
    return values.filter(order => toDate(order.createdAt).getTime() >= threshold);
  }
  function ranked(values) {
    return Object.entries(values).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }
  function renderRanking(id, entries, formatter = String) {
    byId(id).innerHTML = entries.length
      ? entries.map(([label, value], index) => `<li><span><b>${index + 1}</b>${escapeHtml(label)}</span><strong>${formatter(value)}</strong></li>`).join('')
      : '<li class="adminEmpty">Dati non disponibili.</li>';
  }
  function renderAnalytics() {
    if (!isAdmin()) return;
    const values = periodOrders();
    const summary = metrics(values);
    const byUser = {};
    const byProduct = {};
    const bySupplier = {};
    const byDay = {};
    values.forEach(order => {
      const user = order.user || order.email || 'Cliente';
      byUser[user] = (byUser[user] || 0) + 1;
      bySupplier[supplierLabel(order)] = (bySupplier[supplierLabel(order)] || 0) + 1;
      const day = localDay(order.createdAt);
      byDay[day] = (byDay[day] || 0) + Number(order.total || 0);
      (order.items || []).forEach(item => { byProduct[item.name] = (byProduct[item.name] || 0) + 1; });
    });
    const uniqueUsers = Object.keys(byUser).length;
    const repeatUsers = Object.values(byUser).filter(count => count > 1).length;
    const beforeCutoff = values.filter(order => {
      const date = toDate(order.createdAt);
      return date.getHours() < 12 || (date.getHours() === 12 && date.getMinutes() === 0);
    }).length;
    byId('analyticsUnique').textContent = String(uniqueUsers);
    byId('analyticsRepeat').textContent = uniqueUsers ? `${Math.round(repeatUsers / uniqueUsers * 100)}%` : '0%';
    byId('analyticsPerUser').textContent = money(uniqueUsers ? summary.revenue / uniqueUsers : 0);
    byId('analyticsPending').textContent = money(summary.pending);
    byId('analyticsCutoff').textContent = values.length ? `${Math.round(beforeCutoff / values.length * 100)}%` : '0%';
    renderRanking('topUsers', ranked(byUser));
    renderRanking('topProducts', ranked(byProduct));
    renderRanking('salesMix', ranked(bySupplier));
    renderRanking('revenueByDay', ranked(byDay), money);
  }
  async function renderMenuGovernance() {
    if (!isAdmin()) return;
    const products = window.__PAGNOTTELLA_MENU__?.products || [];
    const active = products.filter(product => product.isActive !== false);
    const inactive = products.filter(product => product.isActive === false);
    byId('menuActiveCount').textContent = String(active.length);
    byId('menuLowCount').textContent = String(inactive.length);
    byId('menuStatusList').innerHTML = inactive.map(product => `<li><span>${escapeHtml(product.name)}</span><strong>Non ordinabile</strong></li>`).join('') || '<li class="adminEmpty">Tutti i prodotti sono ordinabili.</li>';
    try {
      const settings = await window.DoseSupplierAccess.getSupplierSettings();
      const enabled = settings.pagnottella.enabledForUsers;
      byId('supplierVisibilityStatus').textContent = enabled ? 'Visibile agli utenti autorizzati' : 'Nascosto agli utenti';
      byId('supplierVisibilityToggle').textContent = enabled ? 'Disabilita fornitore' : 'Abilita fornitore';
      byId('supplierVisibilityToggle').dataset.enabled = String(enabled);
    } catch {
      byId('supplierVisibilityStatus').textContent = 'Configurazione non disponibile';
    }
  }
  function renderAll() {
    const panel = byId('adminWorkspace');
    if (!panel) return;
    panel.classList.toggle('hidden', !hasOrderAccess());
    byId('adminShortcut')?.classList.toggle('hidden', !hasOrderAccess());
    if (!hasOrderAccess()) return;
    document.querySelectorAll('[data-admin-restricted]').forEach(element => element.classList.toggle('hidden', !isAdmin()));
    byId('adminSupplierFilter')?.classList.toggle('hidden', !isAdmin());
    renderIdentity();
    renderOrders();
    renderAnalytics();
    renderMenuGovernance();
  }
  function clearOrderState() {
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    orders = [];
    firestore = null;
    ['adminOrdersCount', 'analyticsOrders'].forEach(id => { if (byId(id)) byId(id).textContent = '0'; });
    ['adminRevenue', 'adminAverage', 'adminPending', 'analyticsRevenue', 'analyticsAverage', 'analyticsPending'].forEach(id => {
      if (byId(id)) byId(id).textContent = money(0);
    });
    if (byId('adminOrdersList')) byId('adminOrdersList').replaceChildren();
  }
  async function loadOrders() {
    clearOrderState();
    if (!hasOrderAccess()) { renderAll(); return; }
    try {
      const [appSdk, firestoreSdk] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js')
      ]);
      const app = appSdk.getApps().find(candidate => candidate.name === '[DEFAULT]');
      if (!app) throw new Error('Firebase non inizializzato.');
      const db = firestoreSdk.getFirestore(app);
      const ordersRef = firestoreSdk.collection(db, 'orders');
      const ordersQuery = isAdmin()
        ? firestoreSdk.query(ordersRef, firestoreSdk.orderBy('createdAt', 'desc'))
        : firestoreSdk.query(ordersRef, firestoreSdk.where('supplierId', '==', 'pagnottella'), firestoreSdk.orderBy('createdAt', 'desc'));
      firestore = { db, sdk:firestoreSdk };
      unsubscribe = firestoreSdk.onSnapshot(ordersQuery, snapshot => {
        orders = snapshot.docs.map(document => ({id:document.id, ...document.data()}));
        renderAll();
      }, error => setLoadError(`Impossibile caricare gli ordini (${error?.code || 'errore Firestore'}).`));
    } catch (error) {
      setLoadError(`Impossibile caricare gli ordini (${error?.code || error?.message || 'errore Firestore'}).`);
    }
  }
  async function reconcileOrder(orderId) {
    if (!isAdmin() || !firestore) return;
    try {
      await firestore.sdk.updateDoc(firestore.sdk.doc(firestore.db, 'orders', orderId), {
        paymentStatus:'reconciled',
        reconciled:true,
        reconciledAt:firestore.sdk.serverTimestamp(),
        reconciledBy:session().email
      });
      window.toast?.('Ordine riconciliato');
    } catch (error) {
      window.toast?.(`Riconciliazione non riuscita (${error?.code || 'errore Firestore'})`);
    }
  }
  function daySummary() {
    const values = todayOrders();
    const summary = metrics(values);
    const lines = [`ORDINI — ${new Date().toLocaleDateString('it-IT')}`, `${values.length} ordini · ${money(summary.revenue)}`];
    values.forEach((order, index) => {
      lines.push(`\n${index + 1}. ${order.user || 'Cliente'} · ${supplierLabel(order)} · ${orderStatus(order)} · ${money(order.total)}`);
      orderItems(order).forEach(item => lines.push(`- ${item}`));
    });
    return lines.join('\n');
  }
  async function copyDaySummary() {
    const text = daySummary();
    try { await navigator.clipboard.writeText(text); window.toast?.('Riepilogo copiato'); }
    catch { window.prompt('Copia il riepilogo:', text); }
  }
  function exportOrdersCsv() {
    if (!isAdmin()) return;
    const rows = [['data_ora','fornitore','cliente','email','prodotti','metodo_pagamento','stato_pagamento','totale']];
    scopedOrders().forEach(order => rows.push([
      toDate(order.createdAt).toISOString(), supplierLabel(order), order.user || '', order.email || '',
      (order.items || []).map(item => item.name).join(' | '), order.paymentMethod || '', orderStatus(order), Number(order.total || 0).toFixed(2)
    ]));
    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'}));
    link.download = `ordini-${selectedSupplier()}-${todayKey()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
  async function toggleSupplierVisibility() {
    if (!isAdmin()) return;
    const enabled = byId('supplierVisibilityToggle').dataset.enabled === 'true';
    try {
      await window.DoseSupplierAccess.setSupplierEnabled('pagnottella', !enabled);
      await renderMenuGovernance();
    } catch (error) {
      window.toast?.(error?.message || 'Configurazione non aggiornata');
    }
  }
  function showAdminView(view) {
    if (!isAdmin() && view !== 'orders') return;
    document.querySelectorAll('.adminNav button').forEach(button => button.classList.toggle('active', button.dataset.adminView === view));
    document.querySelectorAll('.adminView').forEach(section => section.classList.toggle('active', section.dataset.adminPanel === view));
  }

  Object.assign(window, {
    reconcilePagnottellaOrder:reconcileOrder,
    copyPagnottellaDaySummary:copyDaySummary,
    exportPagnottellaOrdersCsv:exportOrdersCsv,
    showPagnottellaAdminView:showAdminView,
    togglePagnottellaMenuManagement:() => byId('menuManagementBody')?.classList.toggle('hidden'),
    togglePagnottellaSupplierVisibility:toggleSupplierVisibility,
    scrollToPagnottellaAdmin:() => byId('adminWorkspace')?.scrollIntoView({behavior:'smooth', block:'start'}),
    renderPagnottellaAdmin:renderAll
  });
  window.addEventListener('pagnottella:session-changed', loadOrders);
  window.addEventListener('pagnottella:order-saved', loadOrders);
  document.addEventListener('DOMContentLoaded', () => setTimeout(loadOrders, 300));
})();
