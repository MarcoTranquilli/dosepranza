(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.DosePranzaSatispayStock = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const normalize = value => String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const formatted = cents => `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')} €`;

  function buildSatispayPayload({recipientId, amountCents, amountEuro, note, baseUrl} = {}) {
    const recipient = typeof recipientId === 'string' ? recipientId.trim() : '';
    const euros = typeof amountEuro === 'string' ? Number(amountEuro.replace(/[€\s]/g, '').replace(',', '.')) : amountEuro;
    const amount = Math.round(amountCents !== undefined ? Number(amountCents) : Number(euros) * 100);
    const valid = Number.isSafeInteger(amount) && amount > 0;
    const result = {ready: false, recipientId: recipient, amountCents: valid ? amount : 0, formattedAmount: formatted(valid ? amount : 0)};
    if (!recipient) return {...result, reason: 'missing_recipient'};
    if (!valid) return {...result, reason: 'invalid_amount'};
    if (!/^[a-zA-Z0-9-]{1,64}$/.test(recipient)) return {...result, reason: 'invalid_recipient'};
    const base = baseUrl || 'https://www.satispay.com/app/pay/shops/';
    if (!['https://www.satispay.com/app/pay/shops/', 'https://staging.satispay.com/app/pay/shops/'].includes(base)) return {...result, reason: 'invalid_base_url'};
    // Payment-link API documents amount only; notes stay in the order, never in an invented parameter.
    const url = `${base}${encodeURIComponent(recipient)}?amount=${encodeURIComponent(amount)}`;
    return {...result, ready: true, deepLink: url, webFallbackUrl: url, noteSupported: false};
  }

  function normalizeStockState(rawDoc) {
    const clean = value => {
      const seen = new Set();
      return (Array.isArray(value) ? value : []).filter(v => typeof v === 'string' && v.trim()).map(v => v.trim()).filter(v => {
        const key = normalize(v); if (seen.has(key)) return false; seen.add(key); return true;
      });
    };
    let timestamp = null;
    try { const value = rawDoc?.updatedAt; timestamp = typeof value?.toMillis === 'function' ? value.toMillis() : typeof value === 'number' ? value : null; } catch (_) {}
    return {soldOutItems: clean(rawDoc?.soldOutItems), soldOutIngredients: clean(rawDoc?.soldOutIngredients), updatedAt: Number.isFinite(timestamp) ? timestamp : null};
  }

  function isCatalogItemSoldOut(item, stockState) {
    const state = normalizeStockState(stockState);
    const names = [normalize(item?.id), normalize(item?.name)];
    const itemTerm = state.soldOutItems.find(term => names.includes(normalize(term)));
    if (itemTerm) return {soldOut: true, reason: 'item', matchedTerm: itemTerm};
    const values = [item?.name, item?.description, item?.desc, item?.details, item?.opt,
      ...[item?.ingredients, item?.tags, item?.extras].flatMap(value => Array.isArray(value) ? value : value ? [value] : [])];
    const words = value => normalize(value).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    const haystack = ` ${words(values.map(v => typeof v === 'object' ? v?.name : v).filter(Boolean).join(' '))} `;
    const ingredient = state.soldOutIngredients.find(term => words(term) && haystack.includes(` ${words(term)} `));
    return ingredient ? {soldOut: true, reason: 'ingredient', matchedTerm: ingredient} : {soldOut: false, reason: null, matchedTerm: null};
  }

  function reconcileCartWithStock(cartItems, stockState) {
    const availableItems = [], removedItems = [];
    for (const item of Array.isArray(cartItems) ? cartItems : []) {
      const result = isCatalogItemSoldOut(item, stockState);
      if (result.soldOut) removedItems.push({item, reason: result.reason, matchedTerm: result.matchedTerm});
      else availableItems.push(item);
    }
    return {availableItems, removedItems};
  }

  // QR Model 2 version 6-L, byte mode: 136 data codewords, two RS(86,68) blocks.
  // Fixed mask 0 is valid; four-module quiet zone is always preserved.
  function renderQrCodeSvg(text, options = {}) {
    const bytes = Array.from(new TextEncoder().encode(String(text)));
    if (bytes.length > 134) throw new RangeError('QR: massimo 134 byte');
    const bits = [], append = (value, count) => { for (let i = count - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
    append(4, 4); append(bytes.length, 8); bytes.forEach(b => append(b, 8));
    for (let i = 0, n = Math.min(4, 1088 - bits.length); i < n; i++) bits.push(0);
    while (bits.length % 8) bits.push(0);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((n, b) => (n << 1) | b, 0));
    for (let i = 0; data.length < 136; i++) data.push(i % 2 ? 0x11 : 0xec);
    const multiply = (a, b) => { let n = 0; for (let i = 7; i >= 0; i--) { n = (n << 1) ^ ((n >>> 7) * 0x11d); n ^= ((b >>> i) & 1) * a; } return n; };
    let generator = [1], alpha = 1;
    for (let i = 0; i < 18; i++) {
      const next = Array(generator.length + 1).fill(0);
      generator.forEach((v, j) => { next[j] ^= v; next[j + 1] ^= multiply(v, alpha); });
      generator = next; alpha = multiply(alpha, 2);
    }
    const parity = block => {
      const work = block.concat(Array(18).fill(0));
      for (let i = 0; i < block.length; i++) { const factor = work[i]; for (let j = 0; j < generator.length; j++) work[i + j] ^= multiply(generator[j], factor); }
      return work.slice(-18);
    };
    const blocks = [data.slice(0, 68), data.slice(68)], ecc = blocks.map(parity), stream = [];
    for (let i = 0; i < 68; i++) for (const block of blocks) stream.push(block[i]);
    for (let i = 0; i < 18; i++) for (const block of ecc) stream.push(block[i]);
    const size = 41, matrix = Array.from({length: size}, () => Array(size).fill(false)), reserved = Array.from({length: size}, () => Array(size).fill(false));
    const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < size && y < size) { matrix[y][x] = !!v; reserved[y][x] = true; } };
    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    for (const [cx, cy] of [[3, 3], [37, 3], [3, 37]]) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)); set(cx + dx, cy + dy, d !== 2 && d !== 4); }
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(34 + dx, 34 + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    let remainder = 8; for (let i = 0; i < 10; i++) remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
    const format = ((8 << 10) | remainder) ^ 0x5412, bit = i => (format >>> i) & 1;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i)); set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i)); set(8, size - 8, true);
    let index = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        const y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
        for (let j = 0; j < 2; j++) { const x = right - j; if (!reserved[y][x]) { const v = index < stream.length * 8 ? (stream[index >>> 3] >>> (7 - (index & 7))) & 1 : 0; index++; matrix[y][x] = !!(v ^ ((x + y) % 2 === 0 ? 1 : 0)); } }
      }
    }
    const bounded = (v, fallback, min, max) => Number.isFinite(v) ? Math.max(min, Math.min(max, Math.floor(v))) : fallback;
    const margin = bounded(options.margin, 4, 4, 16), width = bounded(options.size, 180, 180, 1024), extent = size + margin * 2;
    let d = ''; for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (matrix[y][x]) d += `M${x + margin},${y + margin}h1v1h-1z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${width}" viewBox="0 0 ${extent} ${extent}" role="img" aria-label="QR pagamento Satispay" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#ffffff"/><path d="${d}" fill="#111827"/></svg>`;
  }
  return {buildSatispayPayload, renderQrCodeSvg, normalizeStockState, isCatalogItemSoldOut, reconcileCartWithStock, normalize};
});
