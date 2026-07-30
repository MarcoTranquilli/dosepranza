(() => {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.getRegistrations()
    .then(async (regs) => {
      if (!regs || regs.length === 0) return false;
      await Promise.all(regs.map((r) => r.unregister()));
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      return true;
    })
    .then((cleanedLegacyWorker) => {
      if (!cleanedLegacyWorker) return;
      const url = new URL(window.location.href);
      if (!url.searchParams.has('swreset')) {
        url.searchParams.set('swreset', '1');
        window.location.replace(url.toString());
      }
    })
    .catch(() => {});
})();
