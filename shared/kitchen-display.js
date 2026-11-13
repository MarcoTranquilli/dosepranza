/**
 * DosePranza v2.12.0 - Kitchen Display System (KDS)
 * - Prep Checklist & Live Production Aggregation (via DosePranzaAggregator)
 * - Screen Wake Lock API manager with visibilitychange re-acquisition
 * - Bag Label & Kitchen Production Sheet printing (@media print)
 */

const WAKELOCK_PREF_KEY = 'dosepranza_kds_wakelock';

function getTodayKey() {
  try {
    const romeDate = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Rome' }).format(new Date());
    if (/^\d{4}-\d{2}-\d{2}$/.test(romeDate)) return `dosepranza_prep_${romeDate}`;
  } catch (_) {}
  return 'dosepranza_prep_' + new Date().toISOString().slice(0, 10);
}

function getStorage() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) return globalThis.localStorage;
  } catch (_) {}
  return null;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getPrepState() {
  try {
    const storage = getStorage();
    const parsed = JSON.parse(storage?.getItem(getTodayKey()) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

export function setOrderPrepared(orderId, isDone) {
  if (!orderId) return;
  try {
    const storage = getStorage();
    const state = getPrepState();
    if (isDone) {
      state[orderId] = true;
    } else {
      delete state[orderId];
    }
    storage?.setItem(getTodayKey(), JSON.stringify(state));
  } catch (_) {}
}

function normalizeOrdersForAggregation(orders) {
  const list = Array.isArray(orders) ? orders : [];
  return list
    .filter(o => o && typeof o === 'object' && !Array.isArray(o) && o.cancelled !== true && o.status !== 'cancelled')
    .map(ord => {
      const rawItems = Array.isArray(ord.items) ? ord.items : [];
      const orderNoteParts = [ord.notes, ord.allergies].map(v => String(v || '').trim()).filter(Boolean);
      const orderNote = orderNoteParts.join(' · ');
      const items = rawItems
        .filter(it => it && typeof it.name === 'string' && it.name.trim())
        .map((it, idx) => {
          const variantParts = [
            it.variant,
            it.details,
            it.bread,
            Array.isArray(it.extras) && it.extras.length ? `+ ${it.extras.join(', ')}` : ''
          ].map(v => String(v || '').trim()).filter(Boolean);
          const itemNoteParts = [it.note, idx === 0 ? orderNote : ''].map(v => String(v || '').trim()).filter(Boolean);
          return {
            name: it.name.trim(),
            variant: variantParts.join(' · '),
            qty: Number(it.qty ?? it.quantity ?? 1) || 1,
            priceCents: Number.isFinite(it.priceCents) ? it.priceCents : undefined,
            price: it.price,
            note: itemNoteParts.join(' · ')
          };
        });
      return {
        ...ord,
        items
      };
    });
}

function fallbackAggregate(orders, prepState) {
  const itemMap = new Map();
  let totalOrders = 0;
  let readyOrders = 0;
  for (const ord of orders) {
    totalOrders++;
    if (ord.id && prepState && prepState[ord.id]) readyOrders++;
    for (const item of ord.items || []) {
      const key = `${item.name.toLowerCase()}::${(item.variant || '').toLowerCase()}`;
      if (!itemMap.has(key)) {
        itemMap.set(key, { key, name: item.name, variant: item.variant || '', qty: 0, notes: [] });
      }
      const entry = itemMap.get(key);
      entry.qty += Math.max(1, Math.floor(Number(item.qty) || 1));
      if (item.note && !entry.notes.includes(item.note)) entry.notes.push(item.note);
    }
  }
  const itemsSummary = Array.from(itemMap.values()).sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name, 'it'));
  return {
    totalOrders,
    readyOrders,
    pendingOrders: totalOrders - readyOrders,
    totalAmountCents: 0,
    formattedTotal: '0,00 €',
    byPayment: {
      Satispay: { count: 0, amountCents: 0, formatted: '0,00 €' },
      Contanti: { count: 0, amountCents: 0, formatted: '0,00 €' },
      Altro: { count: 0, amountCents: 0, formatted: '0,00 €' }
    },
    itemsSummary
  };
}

export function buildKitchenProductionState(orders = [], prepState = getPrepState()) {
  const normalized = normalizeOrdersForAggregation(orders);
  const aggregator = (typeof globalThis !== 'undefined' && globalThis.DosePranzaAggregator) || null;
  const summary = aggregator && typeof aggregator.aggregateOrders === 'function'
    ? aggregator.aggregateOrders(normalized, prepState)
    : fallbackAggregate(normalized, prepState);

  const activeNotes = [];
  for (const ord of normalized) {
    const customer = String(ord.user || ord.userName || ord.email || 'Cliente').trim();
    const noteText = [ord.notes, ord.allergies].map(v => String(v || '').trim()).filter(Boolean).join(' · ');
    const itemNotes = (ord.items || []).map(i => String(i.note || '').trim()).filter(Boolean);
    const combined = Array.from(new Set([noteText, ...itemNotes].filter(Boolean))).join(' · ');
    if (combined) {
      activeNotes.push({
        orderId: ord.id || '',
        customer,
        note: combined,
        ready: Boolean(ord.id && prepState && prepState[ord.id])
      });
    }
  }

  return {
    ...summary,
    activeNotes
  };
}

function formatOrderTimeRome(createdAt) {
  if (!createdAt) return '';
  let d = null;
  if (typeof createdAt.toDate === 'function') d = createdAt.toDate();
  else if (createdAt.seconds) d = new Date(createdAt.seconds * 1000);
  else d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });
  } catch (_) {
    return '';
  }
}

function formatEuro(amount) {
  const num = Number(amount);
  if (!Number.isFinite(num)) return '';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(num);
}

export function renderBagLabelHtml(order, meta = {}) {
  const vendorLabel = escapeHtml(meta.vendorLabel || 'DOSepranza');
  const dayLabel = escapeHtml(meta.day || '');
  const timeLabel = escapeHtml(formatOrderTimeRome(order?.createdAt));
  const customer = escapeHtml(order?.user || order?.userName || order?.email || 'Cliente');
  const rawItems = Array.isArray(order?.items) ? order.items : [];
  const itemsHtml = rawItems.length
    ? rawItems.map(it => {
        const qty = Math.max(1, Math.floor(Number(it.qty ?? it.quantity ?? 1) || 1));
        const name = escapeHtml(it.name || 'Prodotto');
        const variant = [it.variant, it.details, it.bread].map(v => String(v || '').trim()).filter(Boolean).join(' · ');
        const variantHtml = variant ? ` <small>(${escapeHtml(variant)})</small>` : '';
        return `<li><strong>${qty}×</strong> ${name}${variantHtml}</li>`;
      }).join('')
    : '<li>Nessun articolo</li>';

  const noteStr = [order?.notes, order?.allergies].map(v => String(v || '').trim()).filter(Boolean).join(' · ');
  const notesHtml = noteStr
    ? `<div class="kds-ticket-notes">⚠️ NOTE / ALLERGIE: ${escapeHtml(noteStr)}</div>`
    : '';

  const rawPay = String(order?.paymentMethod || order?.pagamento || '').trim();
  const payLabel = /satispay/i.test(rawPay) ? 'Satispay' : (/contant|cash/i.test(rawPay) ? 'Contanti' : (rawPay || 'Da definire'));
  const totalStr = order?.total !== undefined ? formatEuro(order.total) : '';

  return `
    <article class="kds-ticket" aria-label="Etichetta ordine">
      <div class="kds-ticket-meta">
        <span>${vendorLabel}</span>
        <span>${dayLabel}${timeLabel ? ` · ${timeLabel}` : ''}</span>
      </div>
      <h2 class="kds-ticket-customer">${customer}</h2>
      <ul class="kds-ticket-items">${itemsHtml}</ul>
      ${notesHtml}
      <div class="kds-ticket-footer">
        <span>Pagamento: ${escapeHtml(payLabel)}</span>
        <span>${escapeHtml(totalStr)}</span>
      </div>
    </article>
  `.trim();
}

export function renderKitchenSummaryHtml(productionState, meta = {}) {
  const vendorLabel = escapeHtml(meta.vendorLabel || 'Riepilogo Cucina');
  const dayLabel = escapeHtml(meta.day || '');
  const rowsHtml = (productionState?.itemsSummary || []).length
    ? productionState.itemsSummary.map(item => `
        <tr>
          <td><strong>${item.qty}×</strong></td>
          <td>${escapeHtml(item.name)}${item.variant ? ` <small>(${escapeHtml(item.variant)})</small>` : ''}</td>
          <td>${item.notes?.length ? escapeHtml(item.notes.join('; ')) : '—'}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="3">Nessun articolo da preparare.</td></tr>';

  return `
    <section class="kds-summary-print">
      <h1>${vendorLabel} — Riepilogo Produzione Cucina</h1>
      <p>Data: ${dayLabel} · Comande: ${productionState.totalOrders} (${productionState.pendingOrders} da preparare, ${productionState.readyOrders} pronte)</p>
      <table class="kds-summary-table">
        <thead>
          <tr>
            <th style="width: 15%;">Q.tà</th>
            <th style="width: 50%;">Prodotto & Variante</th>
            <th style="width: 35%;">Note / Allergie</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </section>
  `.trim();
}

export function createWakeLockController(options = {}) {
  const nav = options.navigator || (typeof navigator !== 'undefined' ? navigator : null);
  const doc = options.document || (typeof document !== 'undefined' ? document : null);
  const storage = options.storage !== undefined ? options.storage : getStorage();
  const onStateChange = typeof options.onStateChange === 'function' ? options.onStateChange : () => {};

  let sentinel = null;
  let desired = false;
  let active = false;

  try {
    desired = storage?.getItem(WAKELOCK_PREF_KEY) === '1';
  } catch (_) {}

  const isSupported = () => Boolean(nav && nav.wakeLock && typeof nav.wakeLock.request === 'function');

  function notify() {
    onStateChange({ supported: isSupported(), desired, active });
  }

  async function acquire() {
    if (!isSupported()) {
      active = false;
      notify();
      return false;
    }
    if (sentinel && !sentinel.released) {
      active = true;
      notify();
      return true;
    }
    try {
      const nextSentinel = await nav.wakeLock.request('screen');
      sentinel = nextSentinel;
      active = true;
      if (sentinel && typeof sentinel.addEventListener === 'function') {
        sentinel.addEventListener('release', () => {
          if (sentinel === nextSentinel) {
            sentinel = null;
            active = false;
            notify();
          }
        }, { once: true });
      }
      notify();
      return true;
    } catch (_) {
      sentinel = null;
      active = false;
      notify();
      return false;
    }
  }

  async function release() {
    const current = sentinel;
    sentinel = null;
    active = false;
    if (current && typeof current.release === 'function') {
      try {
        await current.release();
      } catch (_) {}
    }
    notify();
  }

  async function setEnabled(enabled) {
    desired = Boolean(enabled);
    try {
      if (desired) storage?.setItem(WAKELOCK_PREF_KEY, '1');
      else storage?.removeItem?.(WAKELOCK_PREF_KEY);
    } catch (_) {}

    if (desired) return acquire();
    await release();
    return false;
  }

  async function toggle() {
    return setEnabled(!desired);
  }

  const handleVisibility = () => {
    if (doc && doc.visibilityState === 'visible' && desired) {
      acquire();
    }
  };

  if (doc && typeof doc.addEventListener === 'function') {
    doc.addEventListener('visibilitychange', handleVisibility);
  }

  if (desired) {
    acquire();
  } else {
    notify();
  }

  return {
    isSupported,
    isEnabled: () => desired,
    isActive: () => active,
    setEnabled,
    toggle,
    acquire,
    release,
    destroy() {
      if (doc && typeof doc.removeEventListener === 'function') {
        doc.removeEventListener('visibilitychange', handleVisibility);
      }
      return release();
    }
  };
}

let liveContext = {
  supplier: '',
  vendorLabel: '',
  day: '',
  orders: []
};
let wakeLockCtrl = null;

function detectVendorLabel() {
  if (typeof document === 'undefined') return 'DOSepranza';
  if (document.body?.classList.contains('supplier-dashboard--russo')) return 'Alimentari Russo';
  if (document.body?.classList.contains('supplier-dashboard--pagnottella')) return 'La Pagnottella Gourmet';
  return document.querySelector('.brand h1')?.textContent?.trim() || 'DOSepranza';
}

function ensurePrintSheet() {
  if (typeof document === 'undefined') return null;
  let sheet = document.getElementById('kds-print-sheet');
  if (!sheet) {
    sheet = document.createElement('div');
    sheet.id = 'kds-print-sheet';
    sheet.className = 'kds-print-sheet';
    sheet.setAttribute('aria-hidden', 'true');
    document.body.appendChild(sheet);
  }
  return sheet;
}

function triggerKdsPrint(mode, html) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const sheet = ensurePrintSheet();
  if (!sheet) return;
  sheet.innerHTML = html;
  document.body.dataset.kdsPrintMode = mode;

  const cleanup = () => {
    delete document.body.dataset.kdsPrintMode;
  };
  window.addEventListener('afterprint', cleanup, { once: true });
  try {
    window.print();
  } finally {
    setTimeout(cleanup, 1200);
  }
}

function renderProductionPanel() {
  if (typeof document === 'undefined') return;
  const mainView = document.getElementById('main-view');
  if (!mainView) return;

  let panel = document.getElementById('kds-production-panel');
  if (!panel) {
    panel = document.createElement('section');
    panel.id = 'kds-production-panel';
    panel.className = 'kds-panel';
    panel.setAttribute('aria-label', 'Riepilogo Produzione Cucina');
    const actionsBar = mainView.querySelector('.actions-bar');
    if (actionsBar && actionsBar.parentNode) {
      actionsBar.insertAdjacentElement('afterend', panel);
    } else {
      mainView.prepend(panel);
    }
  }

  const state = buildKitchenProductionState(liveContext.orders, getPrepState());
  const vendorLabel = liveContext.vendorLabel || detectVendorLabel();
  const day = liveContext.day || document.getElementById('order-date')?.value || '';

  const itemsHtml = state.itemsSummary.length
    ? `<div class="kds-grid">${state.itemsSummary.map(item => `
        <div class="kds-item-chip">
          <span class="kds-item-qty">${item.qty}×</span>
          <div>
            <span class="kds-item-name">${escapeHtml(item.name)}</span>
            ${item.variant ? `<span class="kds-item-variant">${escapeHtml(item.variant)}</span>` : ''}
          </div>
        </div>
      `).join('')}</div>`
    : '<p class="kds-empty">Nessun pezzo attivo in produzione per la data selezionata.</p>';

  const notesHtml = state.activeNotes.length
    ? `<div class="kds-notes-box" role="region" aria-label="Note e allergie attive">
        <strong>⚠️ Note &amp; Allergie attive (${state.activeNotes.length})</strong>
        <ul class="kds-notes-list">
          ${state.activeNotes.map(n => `<li><strong>${escapeHtml(n.customer)}:</strong> ${escapeHtml(n.note)}</li>`).join('')}
        </ul>
      </div>`
    : '';

  panel.innerHTML = `
    <div class="kds-panel-head">
      <div class="kds-panel-title-group">
        <h2 class="kds-panel-title">Riepilogo Produzione Cucina</h2>
        <div class="kds-badges">
          <span class="kds-badge kds-badge--pending">${state.pendingOrders} da preparare</span>
          <span class="kds-badge kds-badge--ready">${state.readyOrders} pronte</span>
          <span class="kds-badge">${state.totalOrders} totali</span>
        </div>
      </div>
      <button id="kds-print-summary-btn" type="button" class="kds-print-summary-btn"${state.totalOrders ? '' : ' disabled'}>
        🖨️ Stampa riepilogo cucina
      </button>
    </div>
    ${itemsHtml}
    ${notesHtml}
  `;

  const printBtn = panel.querySelector('#kds-print-summary-btn');
  if (printBtn) {
    printBtn.onclick = () => {
      if (!state.totalOrders) return;
      triggerKdsPrint('summary', renderKitchenSummaryHtml(state, { vendorLabel, day }));
    };
  }
}

function mountWakeLockButton() {
  if (typeof document === 'undefined') return;
  const userPanel = document.querySelector('.user-panel');
  if (!userPanel || document.getElementById('kds-wakelock-toggle')) return;

  const btn = document.createElement('button');
  btn.id = 'kds-wakelock-toggle';
  btn.type = 'button';
  btn.className = 'kds-wakelock-btn';
  btn.setAttribute('aria-pressed', 'false');
  btn.textContent = '🌙 Schermo sempre attivo';
  userPanel.insertBefore(btn, userPanel.firstChild);

  wakeLockCtrl = createWakeLockController({
    onStateChange({ supported, desired, active }) {
      btn.dataset.supported = String(supported);
      btn.setAttribute('aria-pressed', String(desired));
      btn.classList.toggle('is-active', desired);
      if (!supported) {
        btn.textContent = '🌙 Schermo attivo (non supp.)';
        btn.title = 'Screen Wake Lock non supportato da questo browser';
      } else if (active) {
        btn.textContent = '☀️ Schermo sempre attivo';
        btn.title = 'Blocco stand-by schermo attivo';
      } else if (desired) {
        btn.textContent = '☀️ Schermo attivo (in attesa)';
        btn.title = 'Si riattiva automaticamente quando la scheda è in primo piano';
      } else {
        btn.textContent = '🌙 Schermo sempre attivo';
        btn.title = 'Attiva per impedire lo spegnimento dello schermo durante la preparazione';
      }
    }
  });

  btn.addEventListener('click', () => {
    wakeLockCtrl?.toggle();
  });
}

export function syncOrders(payload = {}) {
  liveContext = {
    supplier: payload.supplier || liveContext.supplier,
    vendorLabel: payload.vendorLabel || detectVendorLabel(),
    day: payload.day || (typeof document !== 'undefined' ? document.getElementById('order-date')?.value || '' : ''),
    orders: Array.isArray(payload.orders) ? payload.orders : []
  };
  applyPrepStyles();
  renderProductionPanel();
}

export function applyPrepStyles() {
  if (typeof document === 'undefined') return;
  const state = getPrepState();
  const rows = document.querySelectorAll('tr[data-order-id], .order-card, tbody tr');
  rows.forEach(row => {
    const id = row.getAttribute('data-order-id') || row.id || row.querySelector('span')?.textContent?.trim();
    if (!id || row.querySelector('.empty-state')) return;

    const isDone = Boolean(state[id]);
    if (isDone) {
      row.classList.add('order-prepared');
    } else {
      row.classList.remove('order-prepared');
    }

    const actionCell = row.querySelector('td:last-child') || row;
    let actionWrap = actionCell.querySelector('.kds-row-actions');
    if (!actionWrap && actionCell !== row) {
      actionWrap = document.createElement('div');
      actionWrap.className = 'kds-row-actions';
      actionCell.appendChild(actionWrap);
    }
    const targetContainer = actionWrap || actionCell;

    let btn = row.querySelector('.prep-toggle-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'prep-toggle-btn';
      btn.setAttribute('aria-label', 'Segna comanda come pronta');
      btn.onclick = (e) => {
        e.stopPropagation();
        const next = !row.classList.contains('order-prepared');
        setOrderPrepared(id, next);
        row.classList.toggle('order-prepared', next);
        btn.innerHTML = next ? '✓ Pronta' : '◯ Da fare';
        renderProductionPanel();
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate(15); } catch (_) {}
        }
      };
      targetContainer.appendChild(btn);
    }
    btn.innerHTML = isDone ? '✓ Pronta' : '◯ Da fare';

    const matchedOrder = (liveContext.orders || []).find(o => o && o.id === id);
    if (matchedOrder && !row.querySelector('.kds-label-btn')) {
      const labelBtn = document.createElement('button');
      labelBtn.type = 'button';
      labelBtn.className = 'kds-label-btn';
      labelBtn.setAttribute('aria-label', 'Stampa etichetta sacchetto');
      labelBtn.textContent = '🏷️ Etichetta';
      labelBtn.onclick = (e) => {
        e.stopPropagation();
        const vendorLabel = liveContext.vendorLabel || detectVendorLabel();
        const day = liveContext.day || document.getElementById('order-date')?.value || '';
        triggerKdsPrint('label', renderBagLabelHtml(matchedOrder, { vendorLabel, day }));
      };
      targetContainer.appendChild(labelBtn);
    }
  });
}

if (typeof window !== 'undefined') {
  window.DoseKitchenDisplay = {
    getPrepState,
    setOrderPrepared,
    applyPrepStyles,
    syncOrders,
    buildKitchenProductionState,
    renderBagLabelHtml,
    renderKitchenSummaryHtml,
    createWakeLockController
  };
  window.addEventListener('dosepranza:orders-rendered', (event) => {
    if (event?.detail) syncOrders(event.detail);
  });
}

if (typeof document !== 'undefined') {
  const initKds = () => {
    mountWakeLockButton();
    applyPrepStyles();
    renderProductionPanel();
    try {
      const observer = new MutationObserver(() => applyPrepStyles());
      const target = document.getElementById('orders-tbody') || document.querySelector('tbody');
      if (target) observer.observe(target, { childList: true });
    } catch (_) {}
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initKds);
  } else {
    initKds();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getPrepState,
    setOrderPrepared,
    applyPrepStyles,
    syncOrders,
    buildKitchenProductionState,
    renderBagLabelHtml,
    renderKitchenSummaryHtml,
    createWakeLockController,
    escapeHtml
  };
}
