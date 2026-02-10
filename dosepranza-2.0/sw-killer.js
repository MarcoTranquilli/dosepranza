(() => {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.getRegistrations()
    .then((regs) => {
      if (!regs || regs.length === 0) return false;
      return Promise.all(regs.map((r) => r.unregister())).then(() => true);
    })
    .then((hadSW) => {
      if (!hadSW) return;
      if ('caches' in window) {
        return caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
      }
    })
    .then(() => {
      const url = new URL(window.location.href);
      if (!url.searchParams.has('swreset')) {
        url.searchParams.set('swreset', '1');
        window.location.replace(url.toString());
      }
    })
    .catch(() => {});
})();
