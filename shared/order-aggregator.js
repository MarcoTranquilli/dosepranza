(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.DosePranzaAggregator = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function integer(value) {
    const rounded = Math.round(value);
    if (!Number.isSafeInteger(rounded)) throw new RangeError('Importo o quantita fuori intervallo');
    return rounded;
  }

  function formatEuroCents(cents) {
    const value = Number.isFinite(cents) ? integer(cents) : 0;
    const abs = Math.abs(value);
    return `${value < 0 ? '-' : ''}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')} €`;
  }

  function toCents(amount) {
    const value = typeof amount === 'string'
      ? Number(amount.replace(/[€\s]/g, '').replace(',', '.')) : amount;
    return typeof value === 'number' && Number.isFinite(value) ? integer(value * 100) : 0;
  }

  function normalizePaymentMethod(rawMethod) {
    const value = String(rawMethod || '').trim().toLowerCase();
    if (value.includes('satispay')) return 'Satispay';
    if (value.includes('contant') || value.includes('cash')) return 'Contanti';
    return 'Altro';
  }

  function aggregateOrders(orders = [], prepState = {}) {
    const byPayment = {
      Satispay: {count: 0, amountCents: 0, formatted: '0,00 €'},
      Contanti: {count: 0, amountCents: 0, formatted: '0,00 €'},
      Altro: {count: 0, amountCents: 0, formatted: '0,00 €'}
    };
    const itemMap = new Map();
    let totalOrders = 0;
    let readyOrders = 0;
    let totalAmountCents = 0;
    for (const order of Array.isArray(orders) ? orders : []) {
      if (!order || typeof order !== 'object' || Array.isArray(order) || order.cancelled === true || order.status === 'cancelled') continue;
      totalOrders++;
      if (order.id && prepState && Object.prototype.hasOwnProperty.call(prepState, order.id) && prepState[order.id]) readyOrders++;
      let computedItemsCents = 0;
      for (const item of Array.isArray(order.items) ? order.items : []) {
        if (!item || typeof item.name !== 'string' || !item.name.trim()) continue;
        const rawQty = Number(item.qty ?? item.quantity ?? 1);
        const qty = Number.isFinite(rawQty) ? integer(Math.max(1, Math.floor(rawQty))) : 1;
        const unitCents = Number.isFinite(item.priceCents) ? integer(item.priceCents) : toCents(item.price);
        computedItemsCents = integer(computedItemsCents + integer(unitCents * qty));
        const name = item.name.trim();
        const variant = item.variant ? String(item.variant).trim() : '';
        const key = `${name.toLowerCase()}::${variant.toLowerCase()}`;
        if (!itemMap.has(key)) itemMap.set(key, {key, name, variant, qty: 0, notes: []});
        const entry = itemMap.get(key);
        entry.qty = integer(entry.qty + qty);
        const note = item.note ? String(item.note).trim() : '';
        if (note && !entry.notes.includes(note)) entry.notes.push(note);
      }
      const amount = Number.isFinite(order.totalCents) ? integer(order.totalCents)
        : order.total !== undefined ? toCents(order.total) : computedItemsCents;
      totalAmountCents = integer(totalAmountCents + amount);
      const payment = byPayment[normalizePaymentMethod(order.paymentMethod || order.pagamento)];
      payment.count++;
      payment.amountCents = integer(payment.amountCents + amount);
    }
    for (const payment of Object.values(byPayment)) payment.formatted = formatEuroCents(payment.amountCents);
    const itemsSummary = Array.from(itemMap.values()).sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name, 'it'));
    return {totalOrders, readyOrders, pendingOrders: totalOrders - readyOrders, totalAmountCents,
      formattedTotal: formatEuroCents(totalAmountCents), byPayment, itemsSummary};
  }

  function formatKitchenSummaryText(summary, meta = {}) {
    const title = meta.vendorLabel || 'Riepilogo Comande';
    const lines = [meta.isoDate ? `${title} (${meta.isoDate})` : title,
      `Comande: ${summary.totalOrders} (${summary.readyOrders} pronte, ${summary.pendingOrders} da fare)`,
      `Totale: ${summary.formattedTotal} | Satispay: ${summary.byPayment.Satispay.formatted} (${summary.byPayment.Satispay.count}) | Contanti: ${summary.byPayment.Contanti.formatted} (${summary.byPayment.Contanti.count})`];
    if (summary.itemsSummary.length) {
      lines.push('--- Articoli ---');
      for (const item of summary.itemsSummary) {
        lines.push(`${item.qty}× ${item.name}${item.variant ? ` [${item.variant}]` : ''}${item.notes.length ? ` — Note: ${item.notes.join('; ')}` : ''}`);
      }
    }
    return lines.join('\n');
  }

  return {formatEuroCents, toCents, normalizePaymentMethod, aggregateOrders, formatKitchenSummaryText};
});
