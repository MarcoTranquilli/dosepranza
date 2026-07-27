(() => {
  const ADMIN_EMAIL = 'marco.tranquilli@dos.design';
  const SUPPLIER_EMAIL = 'commerciale@lapagnottellagourmet.it';
  const STORAGE_KEY = 'dose_preview_pagnottella_orders';
  const byId = id => document.getElementById(id);
  const money = value => `€${Number(value || 0).toFixed(2).replace('.', ',')}`;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
  }[char]));
  const localDay = value => {
    const date = new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const todayKey = () => localDay(Date.now());

  function session() {
    try { return JSON.parse(localStorage.getItem('dose_user') || 'null'); }
    catch { return null; }
  }
  function isAdmin() {
    const user = session();
    return user?.email?.toLowerCase() === ADMIN_EMAIL || user?.role === 'admin' || user?.isAdmin === true;
  }
  function isSupplier() {
    const user = session();
    return user?.email?.toLowerCase() === SUPPLIER_EMAIL && user?.role === 'supplier';
  }
  function hasOrderAccess() {
    return isAdmin() || isSupplier();
  }
  function readOrders() {
    try {
      const orders = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(orders) ? orders : [];
    } catch {
      return [];
    }
  }
  function writeOrders(orders) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders.slice(0, 100)));
  }
  function todayOrders() {
    return readOrders().filter(order => localDay(order.createdAt) === todayKey());
  }
  function orderStatus(order) {
    if(order.reconciled) return 'Riconciliato';
    if(order.paymentStatus === 'declared_paid') return 'Dichiarato pagato';
    return 'Da verificare';
  }
  function statusClass(order) {
    if(order.reconciled) return 'isReconciled';
    if(order.paymentStatus === 'declared_paid') return 'isDeclared';
    return 'isPending';
  }
  function itemCopy(item) {
    const extras = (item.extras || []).map(extra => `${extra.name} (+${money(extra.price)})`).join(', ');
    return `${item.name} — ${item.option || item.details || 'Standard'}${extras ? ` · Extra: ${extras}` : ''}`;
  }
  function orderItems(order) {
    return (order.items || []).map(itemCopy);
  }
  function aggregateMetrics(orders) {
    const revenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    return {
      count: orders.length,
      revenue,
      average: orders.length ? revenue / orders.length : 0,
      pending: orders.filter(order => !order.reconciled).reduce((sum, order) => sum + Number(order.total || 0), 0)
    };
  }
  function renderIdentity() {
    const user = session() || { email:ADMIN_EMAIL, role:'admin' };
    if(byId('adminIdentity')) byId('adminIdentity').textContent = `${user.email || ADMIN_EMAIL} · ${isAdmin() ? 'admin' : 'fornitore'}`;
    if(byId('adminShortcut')) byId('adminShortcut').textContent = isAdmin() ? 'Area admin' : 'Area ordini';
    if(byId('adminAccessCopy')) byId('adminAccessCopy').textContent = isAdmin()
      ? 'Accesso avanzato attivo: puoi gestire prodotti, ordini e disponibilità.'
      : 'Accesso fornitore attivo: puoi consultare gli ordini demo della Pagnottella.';
  }
  function renderOrders() {
    const orders = todayOrders();
    const metrics = aggregateMetrics(orders);
    byId('adminOrdersCount').textContent = String(metrics.count);
    byId('adminRevenue').textContent = money(metrics.revenue);
    byId('adminAverage').textContent = money(metrics.average);
    byId('adminPending').textContent = money(metrics.pending);
    const list = byId('adminOrdersList');
    list.innerHTML = orders.length ? orders.map(order => `
      <article class="adminOrderCard" data-order-id="${escapeHtml(order.id)}">
        <header>
          <div><strong>${escapeHtml(order.user || 'Cliente')}</strong><span>${new Date(order.createdAt).toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit' })}</span></div>
          <span class="orderStatus ${statusClass(order)}">${orderStatus(order)}</span>
        </header>
        <ul>${orderItems(order).map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
        <footer>
          <span>${escapeHtml(order.paymentMethod || 'Metodo non indicato')}</span>
          <strong>${money(order.total)}</strong>
          ${order.reconciled || !isAdmin() ? '' : `<button type="button" onclick="reconcilePagnottellaOrder('${escapeHtml(order.id)}')">Segna riconciliato</button>`}
        </footer>
      </article>
    `).join('') : '<div class="adminEmpty">Nessun ordine locale registrato oggi.</div>';
  }
  function periodOrders() {
    const period = byId('analysisPeriod')?.value || 'today';
    const all = readOrders();
    if(period === 'all') return all;
    const days = period === '30' ? 30 : period === '7' ? 7 : 1;
    const threshold = Date.now() - (days * 24 * 60 * 60 * 1000);
    return all.filter(order => new Date(order.createdAt).getTime() >= threshold);
  }
  function rankedEntries(values) {
    return Object.entries(values).sort((a,b) => b[1]-a[1]).slice(0, 5);
  }
  function renderRanking(id, entries, formatter=value => String(value)) {
    const target = byId(id);
    target.innerHTML = entries.length
      ? entries.map(([label,value], index) => `<li><span><b>${index + 1}</b>${escapeHtml(label)}</span><strong>${formatter(value)}</strong></li>`).join('')
      : '<li class="adminEmpty">Dati non ancora disponibili.</li>';
  }
  function renderAnalytics() {
    const orders = periodOrders();
    const metrics = aggregateMetrics(orders);
    const byUser = {};
    const byProduct = {};
    const byCategory = {};
    const byDay = {};
    orders.forEach(order => {
      const user = order.user || order.email || 'Cliente';
      byUser[user] = (byUser[user] || 0) + 1;
      const day = localDay(order.createdAt);
      byDay[day] = (byDay[day] || 0) + Number(order.total || 0);
      (order.items || []).forEach(item => {
        byProduct[item.name] = (byProduct[item.name] || 0) + 1;
        const category = item.cat || 'Altro';
        byCategory[category] = (byCategory[category] || 0) + 1;
      });
    });
    const uniqueUsers = Object.keys(byUser).length;
    const repeatUsers = Object.values(byUser).filter(count => count > 1).length;
    const beforeCutoff = orders.filter(order => {
      const date = new Date(order.createdAt);
      return date.getHours() < 11 || (date.getHours() === 11 && date.getMinutes() <= 30);
    }).length;
    byId('analyticsUnique').textContent = String(uniqueUsers);
    byId('analyticsRepeat').textContent = uniqueUsers ? `${Math.round(repeatUsers / uniqueUsers * 100)}%` : '0%';
    byId('analyticsPerUser').textContent = money(uniqueUsers ? metrics.revenue / uniqueUsers : 0);
    byId('analyticsPending').textContent = money(metrics.pending);
    byId('analyticsCutoff').textContent = orders.length ? `${Math.round(beforeCutoff / orders.length * 100)}%` : '0%';
    renderRanking('topUsers', rankedEntries(byUser));
    renderRanking('topProducts', rankedEntries(byProduct));
    renderRanking('salesMix', rankedEntries(byCategory));
    renderRanking('revenueByDay', rankedEntries(byDay), money);
  }
  function renderMenuGovernance() {
    const products = window.__PAGNOTTELLA_MENU__?.products || [];
    const active = products.filter(product => product.isActive !== false);
    const simulatedLow = active.filter((_, index) => index % 17 === 0);
    byId('menuActiveCount').textContent = String(active.length);
    byId('menuLowCount').textContent = String(simulatedLow.length);
    byId('menuStatusList').innerHTML = simulatedLow.slice(0, 8).map(product => `
      <li><span>${escapeHtml(product.name)}</span><strong>Soglia simulata</strong></li>
    `).join('') || '<li class="adminEmpty">Nessun prodotto sotto soglia.</li>';
  }
  function renderAll() {
    const panel = byId('adminWorkspace');
    if(!panel) return;
    panel.classList.toggle('hidden', !hasOrderAccess());
    byId('adminShortcut')?.classList.toggle('hidden', !hasOrderAccess());
    if(!hasOrderAccess()) return;
    document.querySelectorAll('[data-admin-restricted]').forEach(element => element.classList.toggle('hidden', !isAdmin()));
    renderIdentity();
    renderOrders();
    if(isAdmin()) {
      renderAnalytics();
      renderMenuGovernance();
    } else {
      showAdminView('orders');
    }
  }
  function reconcileOrder(orderId) {
    if(!isAdmin()) return;
    const orders = readOrders();
    const order = orders.find(item => item.id === orderId);
    if(!order) return;
    order.reconciled = true;
    order.paymentStatus = 'reconciled';
    order.reconciledAt = new Date().toISOString();
    writeOrders(orders);
    renderAll();
  }
  function daySummary() {
    const orders = todayOrders();
    const metrics = aggregateMetrics(orders);
    const lines = [`ORDINI PAGNOTTELLA — ${new Date().toLocaleDateString('it-IT')}`, `${orders.length} ordini · ${money(metrics.revenue)}`];
    orders.forEach((order, index) => {
      lines.push(`\n${index + 1}. ${order.user || 'Cliente'} · ${orderStatus(order)} · ${money(order.total)}`);
      orderItems(order).forEach(item => lines.push(`- ${item}`));
    });
    return lines.join('\n');
  }
  async function copyDaySummary() {
    const text = daySummary();
    try {
      await navigator.clipboard.writeText(text);
      window.toast?.('Riepilogo ordini copiato');
    } catch {
      window.prompt('Copia il riepilogo:', text);
    }
  }
  function exportOrdersCsv() {
    const rows = [['data_ora','cliente','email','prodotti','personalizzazioni_extra','metodo_pagamento','stato_pagamento','totale']];
    todayOrders().forEach(order => rows.push([
      order.createdAt,
      order.user || '',
      order.email || '',
      (order.items || []).map(item => item.name).join(' | '),
      orderItems(order).join(' | '),
      order.paymentMethod || '',
      orderStatus(order),
      Number(order.total || 0).toFixed(2)
    ]));
    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8' }));
    link.download = `ordini-pagnottella-${todayKey()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
  function showAdminView(view) {
    document.querySelectorAll('.adminNav button').forEach(button => button.classList.toggle('active', button.dataset.adminView === view));
    document.querySelectorAll('.adminView').forEach(section => section.classList.toggle('active', section.dataset.adminPanel === view));
  }
  function toggleMenuManagement() {
    byId('menuManagementBody')?.classList.toggle('hidden');
  }
  function scrollToAdmin() {
    byId('adminWorkspace')?.scrollIntoView({ behavior:'smooth', block:'start' });
  }

  Object.assign(window, {
    reconcilePagnottellaOrder: reconcileOrder,
    copyPagnottellaDaySummary: copyDaySummary,
    exportPagnottellaOrdersCsv: exportOrdersCsv,
    showPagnottellaAdminView: showAdminView,
    togglePagnottellaMenuManagement: toggleMenuManagement,
    scrollToPagnottellaAdmin: scrollToAdmin,
    renderPagnottellaAdmin: renderAll
  });
  window.addEventListener('pagnottella:order-saved', renderAll);
  window.addEventListener('storage', event => {
    if(event.key === STORAGE_KEY) renderAll();
  });
  document.addEventListener('DOMContentLoaded', () => setTimeout(renderAll, 200));
  setTimeout(renderAll, 800);
})();
