(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(root);
  else root.DosePranzaClientUX = factory(root);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  async function shareOrCopyReceipt(payload, deps = {}) {
    let nav;
    try {
      nav = deps.nav === undefined ? root.navigator : deps.nav;
      if (typeof nav?.share === 'function') {
        await nav.share({title: payload.title, text: payload.text, ...(payload.url ? {url: payload.url} : {})});
        return {ok: true, method: 'share'};
      }
    } catch (error) {
      if (error?.name === 'AbortError') return {ok: false, method: 'aborted'};
    }
    try {
      if (typeof nav?.clipboard?.writeText === 'function') {
        await nav.clipboard.writeText(payload.text);
        return {ok: true, method: 'clipboard'};
      }
    } catch (_) {}
    return {ok: false, method: 'none'};
  }

  function bindBeforeUnloadCartGuard(hasPendingItemsFn, win = root.window) {
    const handler = event => {
      try {
        if (!hasPendingItemsFn()) return;
        event.preventDefault();
        event.returnValue = '';
      } catch (_) {}
    };
    try { win?.addEventListener('beforeunload', handler); } catch (_) {}
    return () => { try { win?.removeEventListener('beforeunload', handler); } catch (_) {} };
  }

  function createDailyCartStorage(vendorKey, options = {}) {
    if (!['russo', 'pagnottella'].includes(vendorKey)) throw new TypeError('Fornitore non supportato');
    const prefix = `dosepranza_cart_${vendorKey}_`;
    function storage() { return options.storage === undefined ? root.localStorage : options.storage; }
    function day() {
      const now = options.now ? options.now() : Date.now();
      if (root.DosePranzaCutoff) return root.DosePranzaCutoff.getRomeDateParts(now).isoDate;
      const parts = new Intl.DateTimeFormat('en-GB', {timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(new Date(now));
      const part = type => parts.find(value => value.type === type).value;
      return `${part('year')}-${part('month')}-${part('day')}`;
    }
    function purgeStale() {
      try {
        const store = storage(), today = day(), obsolete = [];
        for (let i = 0; i < store.length; i++) {
          const key = store.key(i);
          if (key?.startsWith(prefix)) {
            const date = key.slice(prefix.length);
            if (/^\d{4}-\d{2}-\d{2}$/.test(date) && date < today) obsolete.push(key);
          }
        }
        obsolete.forEach(key => store.removeItem(key));
        return true;
      } catch (_) { return false; }
    }
    function load() {
      purgeStale();
      try {
        const value = JSON.parse(storage()?.getItem(prefix + day()) || 'null');
        if (options.owner) return value?.owner === options.owner() && Array.isArray(value.items) ? value.items : [];
        return Array.isArray(value) ? value : [];
      } catch (_) { return []; }
    }
    function save(items) {
      if (!Array.isArray(items)) return false;
      purgeStale();
      try {
        const store = storage();
        if (!store) return false;
        store.setItem(prefix + day(), JSON.stringify(options.owner ? {owner: options.owner(), items} : items));
        return true;
      } catch (_) { return false; }
    }
    function clear() {
      try { storage()?.removeItem(prefix + day()); return true; } catch (_) { return false; }
    }
    return {load, save, clear, purgeStale};
  }
  return {shareOrCopyReceipt, bindBeforeUnloadCartGuard, createDailyCartStorage};
});
