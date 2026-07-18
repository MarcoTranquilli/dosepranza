(() => {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.getRegistrations()
    .then((regs) => {
      if (!regs || regs.length === 0) return false;
      return Promise.all(regs.map((r) => r.unregister())).then(() => true);
    })
    .then(() => {
      if ('caches' in window) {
        return caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
      }
    })
    .catch(() => {});
})();