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
  const analytics = window.DoseOrderAnalytics;
  let generation = 0;
  let queryKey = '';
  let loadState = 'idle';
  let loadMessage = '';
  let visibleLimit = 50;
  let updatedAt = null;
  const moneyCents = value => value == null ? '—' : money(value / 100);
  const percent = value => value == null ? '—' : `${Math.round(value * 100)}%`;

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
    return analytics.toDate(value);
  }
  function localDay(value) {
    return analytics.day(value);
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
    try { return analytics.select(orders, selection()).rows; } catch { return []; }
  }
  function selection() {
    return { supplier: selectedSupplier(), range: analytics.rangeFor(isAdmin() ? byId('analysisPeriod')?.value || 'today' : 'today', new Date(), byId('analysisFrom')?.value, byId('analysisTo')?.value) };
  }
  function orderStatus(order) {
    if (analytics.payment(order) === 'reconciled') return 'Riconciliato';
    if (analytics.payment(order) === 'declared') return 'Dichiarato pagato';
    return 'Da verificare';
  }
  function statusClass(order) {
    return analytics.payment(order) === 'reconciled' ? 'isReconciled' : analytics.payment(order) === 'declared' ? 'isDeclared' : 'isPending';
  }
  function itemCopy(item) {
    const extras = (Array.isArray(item.extras) ? item.extras : []).filter(extra => extra?.name).map(extra => `${extra.name} (+${money(extra.price)})`).join(', ');
    return `${analytics.quantity(item)}x ${item.name} — ${item.option || item.details || 'Standard'}${extras ? ` · Extra: ${extras}` : ''}`;
  }
  function orderItems(order) {
    return (order.items || []).map(itemCopy);
  }
  function metrics(values) {
    return analytics.aggregate(values);
  }
  function setLoadError(message) {
    orders = []; loadState = 'error'; loadMessage = message; updatedAt = null;
    renderAll();
  }
  function renderIdentity() {
    const user = session();
    byId('adminIdentity').textContent = `${user?.email || ''} · ${isAdmin() ? 'admin' : 'fornitore'}`;
    byId('adminAccessCopy').textContent = isAdmin()
      ? 'Accesso globale: ordini, analytics, export e riconciliazione.'
      : 'Accesso fornitore: sono caricati esclusivamente gli ordini La Pagnottella Gourmet.';
  }
  function renderOrders() {
    const values = scopedOrders();
    const summary = metrics(values);
    byId('adminOrdersCount').textContent = String(summary.count);
    byId('adminRevenue').textContent = moneyCents(summary.cents);
    byId('adminAverage').textContent = moneyCents(summary.averageCents);
    byId('adminPending').textContent = moneyCents(summary.pendingCents);
    byId('adminOrdersList').innerHTML = values.length ? values.slice(0, visibleLimit).map(order => `
      <article class="adminOrderCard" data-order-id="${escapeHtml(order.id)}">
        <header><div><strong>${escapeHtml(order.user || 'Cliente')}</strong><span>${toDate(order.createdAt).toLocaleString('it-IT', {timeZone:analytics.ZONE, day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'})} · ${escapeHtml(supplierLabel(order))}</span></div><span class="orderStatus ${statusClass(order)}">${orderStatus(order)}</span></header>
        <ul>${orderItems(order).map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
        <footer><span>${escapeHtml(order.paymentMethod || 'Metodo non indicato')}</span><strong>${money(order.total)}</strong>${analytics.payment(order) === 'reconciled' || !isAdmin() ? '' : `<button type="button" data-reconcile="${escapeHtml(order.id)}" ${loadState !== 'live' ? 'disabled' : ''}>Segna riconciliato</button>`}</footer>
      </article>`).join('') : `<div class="adminEmpty">${escapeHtml(loadState === 'error' ? loadMessage : loadState === 'loading' ? 'Caricamento dal server...' : 'Nessun ordine valido nel periodo selezionato.')}</div>`;
    byId('adminOrdersList').querySelectorAll('[data-reconcile]').forEach(button => button.addEventListener('click', () => reconcileOrder(button.dataset.reconcile)));
    byId('adminLoadMore').hidden = values.length <= visibleLimit;
    byId('adminOrderCoverage').textContent = values.length ? `${Math.min(visibleLimit, values.length)} di ${values.length} ordini mostrati. Indicatori ed export includono tutti gli ordini validi del filtro.` : '';
  }
  function renderRanking(id, entries, formatter = String) {
    byId(id).innerHTML = entries.length
      ? entries.map(([label, value], index) => `<li><span><b>${index + 1}</b>${escapeHtml(label)}</span><strong>${formatter(value)}</strong></li>`).join('')
      : '<li class="adminEmpty">Dati non disponibili.</li>';
  }
  function renderAnalytics() {
    if (!isAdmin()) return;
    let selected;
    try { selected = analytics.select(orders, selection()); } catch { selected = { rows:[], excluded:0, exclusions:{} }; }
    const summary = metrics(selected.rows);
    const values = { analyticsOrders:summary.count, analyticsRevenue:moneyCents(summary.cents), analyticsReconciled:moneyCents(summary.reconciledCents), analyticsDeclared:moneyCents(summary.declaredCents), analyticsUnverified:moneyCents(summary.unverifiedCents), analyticsAverage:moneyCents(summary.averageCents), analyticsUnits:summary.units, analyticsUnique:summary.uniqueUsers, analyticsRepeat:percent(summary.repeatRate), analyticsPerUser:moneyCents(summary.perUserCents), analyticsPending:moneyCents(summary.pendingCents), analyticsCutoff:percent(summary.cutoffRate) };
    Object.entries(values).forEach(([id, value]) => { byId(id).textContent = String(value); });
    byId('analyticsCutoffBase').textContent = `${summary.cutoffCount} / ${summary.cutoffEligible} ordini classificati`;
    renderRanking('topUsers', summary.topUsers);
    renderRanking('topProducts', summary.topProducts);
    renderRanking('salesMix', summary.suppliers.map(group => [group.label, group.count]));
    renderRanking('revenueByDay', summary.days, moneyCents);
    byId('supplierComparisonBody').innerHTML = summary.suppliers.map(group => `<tr><th scope="row">${escapeHtml(group.label)}</th><td>${group.count}</td><td>${moneyCents(group.cents)}</td><td>${moneyCents(group.reconciledCents)}</td><td>${moneyCents(group.cents - group.reconciledCents)}</td><td>${percent(group.cutoffEligible ? group.cutoffCount / group.cutoffEligible : null)}</td></tr>`).join('') || '<tr><td colspan="6">Nessun dato nel periodo.</td></tr>';
    const labels = { missingDate:'data assente/non valida', futureDate:'data futura', excludedStatus:'bozze/annullamenti/altri tipi', invalidTotal:'totale non valido', invalidItems:'prodotti/quantita non validi', duplicateDocument:'documenti duplicati' };
    const details = Object.entries(selected.exclusions).map(([key, count]) => `${count} ${labels[key]}`);
    byId('analyticsQuality').textContent = `${selected.excluded} esclusi${details.length ? ` (${details.join('; ')})` : ''}. ${summary.unclassified} non classificati; ${summary.missingIdentity} senza identita; ${summary.paymentConflicts} incoerenze pagamento; ${summary.possibleDuplicates} possibili duplicati clientOrderId (inclusi, da verificare).`;
    const qualityIssues = selected.excluded + summary.unclassified + summary.missingIdentity + summary.paymentConflicts + summary.possibleDuplicates;
    byId('analyticsQualityNotice').hidden = !qualityIssues || loadState === 'error' || loadState === 'loading';
    byId('analyticsQualityNotice').textContent = 'Dati da verificare: ordini esclusi, incompleti o incoerenti. Consulta "Qualità dei dati" prima di usare questi valori per decisioni economiche.';
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
    if (!isAdmin()) showAdminView('orders');
    byId('analysisCustomDates').hidden = !isAdmin() || byId('analysisPeriod').value !== 'custom';
    try { const current = selection(); byId('analysisScope').textContent = `${current.supplier === 'all' ? 'Tutti i fornitori' : analytics.SUPPLIERS[current.supplier]} · ${current.range.label} · Europe/Rome`; } catch { byId('analysisScope').textContent = 'Intervallo non valido'; }
    byId('analysisStatus').textContent = loadState === 'live' ? `Confermato dal server · ${orders.length} documenti ricevuti · ${updatedAt?.toLocaleTimeString('it-IT', {timeZone:analytics.ZONE})}` : loadState === 'cache' ? 'Dati locali non confermati dal server. Export e riconciliazione sospesi.' : loadState === 'error' ? loadMessage : 'Caricamento dal server...';
    byId('analysisStatus').dataset.state = loadState;
    document.querySelectorAll('[data-server-required]').forEach(button => { button.disabled = loadState !== 'live'; });
    renderIdentity();
    renderOrders();
    renderAnalytics();
    if (!['live', 'cache'].includes(loadState)) {
      document.querySelectorAll('.adminMetrics strong:not(#menuActiveCount):not(#menuLowCount)').forEach(element => { element.textContent = '—'; });
      byId('analyticsCutoffBase').textContent = 'Dati non disponibili';
    }
    renderMenuGovernance();
  }
  function clearOrderState() {
    generation++;
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    orders = [];
    firestore = null;
    queryKey = ''; updatedAt = null; visibleLimit = 50; loadState = 'loading'; loadMessage = '';
    document.querySelectorAll('.adminMetrics strong').forEach(element => { element.textContent = '—'; });
    ['topUsers', 'topProducts', 'salesMix', 'revenueByDay', 'supplierComparisonBody', 'analyticsQuality', 'analysisStatus', 'analysisScope'].forEach(id => byId(id)?.replaceChildren());
    if (byId('adminOrdersList')) byId('adminOrdersList').replaceChildren();
  }
  async function loadOrders(force = false) {
    let selected;
    if (!hasOrderAccess()) { clearOrderState(); renderAll(); return; }
    try { selected = selection(); } catch (error) { clearOrderState(); setLoadError(error.message); return; }
    const key = `${normalizedEmail()}:${session()?.role}:${selected.supplier}:${selected.range.from}:${selected.range.to}`;
    if (!force && key === queryKey && loadState !== 'error') { renderAll(); return; }
    clearOrderState();
    queryKey = key;
    const activeGeneration = generation;
    const activeEmail = normalizedEmail();
    const activeRole = session()?.role;
    const stillActive = () => generation === activeGeneration && hasOrderAccess() && normalizedEmail() === activeEmail && session()?.role === activeRole;
    renderAll();
    try {
      const [appSdk, firestoreSdk] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js')
      ]);
      if (!stillActive()) return;
      const app = appSdk.getApps().find(candidate => candidate.name === '[DEFAULT]');
      if (!app) throw new Error('Firebase non inizializzato.');
      const db = firestoreSdk.getFirestore(app);
      const ordersRef = firestoreSdk.collection(db, 'orders');
      const constraints = [];
      if (['russo', 'pagnottella'].includes(selected.supplier)) constraints.push(firestoreSdk.where('supplierId', '==', selected.supplier));
      if (selected.range.startDate) constraints.push(firestoreSdk.where('createdAt', '>=', selected.range.startDate), firestoreSdk.where('createdAt', '<', selected.range.endDate), firestoreSdk.orderBy('createdAt', 'desc'));
      // Full history intentionally includes documents with missing dates for the quality audit (admin only).
      const ordersQuery = firestoreSdk.query(ordersRef, ...constraints);
      firestore = { db, sdk:firestoreSdk };
      unsubscribe = firestoreSdk.onSnapshot(ordersQuery, {includeMetadataChanges:true}, snapshot => {
        if (!stillActive()) return;
        orders = snapshot.docs.map(document => ({...document.data(), id:document.id}));
        loadState = snapshot.metadata?.fromCache || snapshot.metadata?.hasPendingWrites ? 'cache' : 'live';
        updatedAt = new Date();
        renderAll();
      }, error => { if (stillActive()) setLoadError(`Impossibile caricare gli ordini (${error?.code || 'errore Firestore'}). Usa Aggiorna per riprovare.`); });
    } catch (error) {
      if (stillActive()) setLoadError(`Impossibile caricare gli ordini (${error?.code || error?.message || 'errore Firestore'}).`);
    }
  }
  async function reconcileOrder(orderId) {
    if (!isAdmin() || !firestore || loadState !== 'live' || !scopedOrders().some(order => order.id === orderId)) return;
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
    const values = scopedOrders();
    const summary = metrics(values);
    const lines = [`ORDINI — ${byId('analysisScope').textContent}`, `${values.length} ordini · Ordinato ${moneyCents(summary.cents)} · Riconciliato ${moneyCents(summary.reconciledCents)}`];
    values.forEach((order, index) => {
      lines.push(`\n${index + 1}. ${order.user || 'Cliente'} · ${supplierLabel(order)} · ${orderStatus(order)} · ${money(order.total)}`);
      orderItems(order).forEach(item => lines.push(`- ${item}`));
    });
    return lines.join('\n');
  }
  async function copyDaySummary() {
    if (!hasOrderAccess() || loadState !== 'live') return;
    const text = daySummary();
    try { await navigator.clipboard.writeText(text); window.toast?.('Riepilogo copiato'); }
    catch { window.prompt('Copia il riepilogo:', text); }
  }
  function exportOrdersCsv() {
    if (!isAdmin() || loadState !== 'live') return;
    const csv = analytics.csv(scopedOrders());
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'}));
    const {range} = selection();
    link.download = `ordini-${selectedSupplier()}-${range.from || 'storico'}-${range.to}.csv`;
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
    renderPagnottellaAdmin:() => loadOrders(),
    refreshPagnottellaAnalytics:() => loadOrders(true),
    loadMorePagnottellaOrders:() => { visibleLimit += 50; renderOrders(); }
  });
  window.addEventListener('pagnottella:session-changed', () => loadOrders(true));
  window.addEventListener('pagnottella:order-saved', () => loadOrders(true));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadOrders(); });
  document.addEventListener('DOMContentLoaded', () => setTimeout(loadOrders, 300));
})();
