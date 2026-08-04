(() => {
  const RELEASE = 'post-go-live-2';
  const RELEASE_KEY = 'dose_cache_release';
  const currentUrl = new URL(window.location.href);
  const forcedReset = currentUrl.searchParams.has('swreset');

  let storedRelease = '';
  try {
    storedRelease = localStorage.getItem(RELEASE_KEY) || '';
  } catch (error) {
    storedRelease = '';
  }

  window.__DOSE_CACHE_READY__ = (async () => {
    if (!forcedReset && storedRelease === RELEASE) return { cleaned:false, release:RELEASE };

    let registrations = [];
    let cacheKeys = [];
    if ('serviceWorker' in navigator) {
      registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration => registration.unregister()));
    }
    if ('caches' in window) {
      cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map(key => caches.delete(key)));
    }

    try {
      localStorage.setItem(RELEASE_KEY, RELEASE);
    } catch (error) {
      // Il bootstrap continua anche se lo storage è indisponibile.
    }

    const cleanedLegacyData = registrations.length > 0 || cacheKeys.length > 0;
    if (cleanedLegacyData && currentUrl.searchParams.get('cachev') !== RELEASE) {
      currentUrl.searchParams.set('cachev', RELEASE);
      window.location.replace(currentUrl.toString());
      return new Promise(() => {});
    }
    return { cleaned:cleanedLegacyData, release:RELEASE };
  })().catch(error => {
    console.warn('Pulizia cache legacy non completata', error?.message || error);
    return { cleaned:false, release:RELEASE, error:true };
  });
})();
