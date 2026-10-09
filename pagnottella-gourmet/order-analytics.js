(() => {
  const ZONE = 'Europe/Rome';
  const SUPPLIERS = Object.freeze({ russo: 'Alimentari Russo', pagnottella: 'La Pagnottella Gourmet', unclassified: 'Non classificato' });
  const clock = new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const email = value => String(value || '').trim().toLowerCase();
  const supplier = order => ['russo', 'pagnottella'].includes(order.supplierId) ? order.supplierId : 'unclassified';
  const quantity = item => Number(item.quantity ?? item.qty ?? 1);
  function toDate(value) {
    try {
      const date = typeof value?.toDate === 'function' ? value.toDate() : value instanceof Date ? value :
        typeof value?.seconds === 'number' ? new Date(value.seconds * 1000) :
        (typeof value === 'string' || typeof value === 'number') ? new Date(value) : null;
      return date && Number.isFinite(date.getTime()) ? date : null;
    } catch { return null; }
  }
  function parts(value) {
    const date = toDate(value);
    return date ? Object.fromEntries(clock.formatToParts(date).map(part => [part.type, part.value])) : null;
  }
  function day(value) {
    const p = parts(value);
    return p ? `${p.year}-${p.month}-${p.day}` : '';
  }
  const addDays = (key, count) => new Date(Date.parse(`${key}T12:00:00Z`) + count * 86400000).toISOString().slice(0, 10);
  const validDay = key => /^\d{4}-\d{2}-\d{2}$/.test(key || '') && toDate(`${key}T12:00:00Z`)?.toISOString().slice(0, 10) === key;
  // Resolve a civil midnight in Rome, including DST boundaries, independently of browser timezone.
  function midnight(key) {
    const target = Date.parse(`${key}T00:00:00Z`);
    let instant = target;
    for (let i = 0; i < 3; i++) {
      const p = parts(instant);
      instant += target - Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
    }
    return new Date(instant);
  }
  function rangeFor(period = 'today', now = new Date(), from = '', to = '') {
    const today = day(now);
    if (period === 'all') return { period, from: '', to: today, startDate: null, endDate: midnight(addDays(today, 1)), label: `Intero storico fino al ${today}` };
    if (period === 'custom') {
      if (!validDay(from) || !validDay(to) || from > to || to > today) throw new Error('Seleziona date valide, in ordine e non future.');
    } else {
      if (!['today', '7', '30'].includes(period)) throw new Error('Periodo non valido.');
      from = addDays(today, -(period === 'today' ? 0 : Number(period) - 1)); to = today;
    }
    return { period, from, to, startDate: midnight(from), endDate: midnight(addDays(to, 1)), label: from === to ? from : `${from} / ${to}` };
  }
  function payment(order) {
    if (order.reconciled === true || (order.reconciled == null && ['paid', 'reconciled'].includes(order.paymentStatus))) return 'reconciled';
    return order.paymentStatus === 'declared_paid' ? 'declared' : 'unverified';
  }
  function invalidReason(order, now) {
    const date = toDate(order.createdAt);
    if (!date) return 'missingDate';
    if (date.getTime() > now.getTime() + 1000) return 'futureDate';
    if (/^(cancelled|canceled|annullato|draft|bozza|void)$/i.test(order.status || '') || (order.orderType && order.orderType !== 'order')) return 'excludedStatus';
    if (typeof order.total !== 'number' || !Number.isFinite(order.total) || order.total <= 0 || !Number.isSafeInteger(Math.round(order.total * 100))) return 'invalidTotal';
    if (!Array.isArray(order.items) || !order.items.length || order.items.some(item => !item || !String(item.name || '').trim() || !Number.isSafeInteger(quantity(item)) || quantity(item) <= 0)) return 'invalidItems';
    return '';
  }
  function select(orders, { supplier: requested = 'all', range = rangeFor(), now = new Date() } = {}) {
    const rows = [], exclusions = {}, seen = new Set();
    for (const order of orders) {
      if (requested !== 'all' && supplier(order) !== requested) continue;
      const date = toDate(order.createdAt);
      if (date && ((range.startDate && date < range.startDate) || date >= range.endDate)) continue;
      const reason = invalidReason(order, now) || (order.id && seen.has(order.id) ? 'duplicateDocument' : '');
      if (reason) { exclusions[reason] = (exclusions[reason] || 0) + 1; continue; }
      if (order.id) seen.add(order.id);
      rows.push(order);
    }
    rows.sort((a, b) => toDate(b.createdAt) - toDate(a.createdAt) || String(a.id).localeCompare(String(b.id)));
    return { rows, exclusions, excluded: Object.values(exclusions).reduce((a, b) => a + b, 0) };
  }
  function aggregate(rows) {
    const users = new Map(), products = new Map(), days = new Map(), suppliers = new Map(), uidEmails = new Map(), clientIds = new Set();
    const result = { count: rows.length, cents: 0, reconciledCents: 0, declaredCents: 0, unverifiedCents: 0, units: 0, cutoffCount: 0, cutoffEligible: 0, missingIdentity: 0, unclassified: 0, paymentConflicts: 0, possibleDuplicates: 0 };
    let identifiedCents = 0;
    for (const order of rows) {
      if (order.uid && email(order.email)) {
        const known = uidEmails.get(order.uid) || new Set(); known.add(email(order.email)); uidEmails.set(order.uid, known);
      }
    }
    for (const order of rows) {
      const cents = Math.round(order.total * 100), id = supplier(order), state = payment(order), date = day(order.createdAt);
      result.cents += cents; result[`${state}Cents`] += cents;
      if (id === 'unclassified') result.unclassified++;
      if ((order.reconciled === false && ['paid', 'reconciled'].includes(order.paymentStatus)) || (order.reconciled === true && !['paid', 'reconciled'].includes(order.paymentStatus))) result.paymentConflicts++;
      if (order.clientOrderId) { const key = `${id}:${order.uid || email(order.email)}:${order.clientOrderId}`; if (clientIds.has(key)) result.possibleDuplicates++; clientIds.add(key); }
      const knownEmails = uidEmails.get(order.uid);
      const identity = email(order.email) || (knownEmails?.size === 1 ? [...knownEmails][0] : order.uid ? `uid:${order.uid}` : '');
      if (identity) {
        const user = users.get(identity) || { label: order.user || order.email || 'Utente identificato', count: 0 };
        user.count++; users.set(identity, user); identifiedCents += cents;
      } else result.missingIdentity++;
      const group = suppliers.get(id) || { id, label: SUPPLIERS[id], count: 0, cents: 0, reconciledCents: 0, cutoffCount: 0, cutoffEligible: 0 };
      group.count++; group.cents += cents; if (state === 'reconciled') group.reconciledCents += cents;
      if (id !== 'unclassified') {
        const p = parts(order.createdAt), seconds = Number(p.hour) * 3600 + Number(p.minute) * 60 + Number(p.second);
        const compliant = seconds <= (id === 'russo' ? 11.5 : 12) * 3600;
        group.cutoffEligible++; result.cutoffEligible++;
        if (compliant) { group.cutoffCount++; result.cutoffCount++; }
      }
      suppliers.set(id, group); days.set(date, (days.get(date) || 0) + cents);
      for (const item of order.items) {
        const units = quantity(item); result.units += units;
        const key = `${id}:${item.id || item.productId || `${item.category || ''}:${String(item.name).trim().toLowerCase()}`}`;
        const product = products.get(key) || { label: `${item.name} · ${SUPPLIERS[id]}`, count: 0 }; product.count += units; products.set(key, product);
      }
    }
    const rank = values => [...values].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'it')).slice(0, 5).map(entry => [entry.label, entry.count]);
    return { ...result, pendingCents: result.declaredCents + result.unverifiedCents, uniqueUsers: users.size,
      repeatRate: users.size ? [...users.values()].filter(user => user.count > 1).length / users.size : null,
      perUserCents: users.size ? identifiedCents / users.size : null, averageCents: rows.length ? result.cents / rows.length : null,
      cutoffRate: result.cutoffEligible ? result.cutoffCount / result.cutoffEligible : null,
      topUsers: rank(users.values()), topProducts: rank(products.values()),
      days: [...days].sort(([a], [b]) => a.localeCompare(b)),
      suppliers: [...suppliers.values()].sort((a, b) => b.cents - a.cents || a.id.localeCompare(b.id)) };
  }
  function csv(rows) {
    const safe = value => { const text = String(value ?? ''); return `"${(/^[\s]*[=+@-]/.test(text) ? "'" + text : text).replace(/"/g, '""')}"`; };
    const data = [['id', 'data_ora_utc', 'giorno_roma', 'fornitore', 'cliente', 'email', 'prodotti_quantita', 'metodo_pagamento', 'stato_pagamento', 'ordinato_eur']];
    for (const order of rows) data.push([order.id, toDate(order.createdAt).toISOString(), day(order.createdAt), SUPPLIERS[supplier(order)], order.user, order.email, order.items.map(item => `${quantity(item)}x ${item.name}`).join(' | '), order.paymentMethod, payment(order), (Math.round(order.total * 100) / 100).toFixed(2)]);
    return '\uFEFF' + data.map(row => row.map(safe).join(',')).join('\r\n');
  }
  globalThis.DoseOrderAnalytics = Object.freeze({ ZONE, SUPPLIERS, supplier, quantity, toDate, day, rangeFor, payment, select, aggregate, csv });
})();
