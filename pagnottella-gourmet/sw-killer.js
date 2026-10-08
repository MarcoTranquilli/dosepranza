(() => {
  const RELEASE = 'mobile-cache-recovery-1';
  const RELEASE_KEY = 'dose_cache_release';
  const RECOVERY_KEY = 'dose_asset_recovery';
  const currentUrl = new URL(window.location.href);
  const forcedReset = currentUrl.searchParams.has('swreset');

  let storedRelease = '';
  try {
    storedRelease = localStorage.getItem(RELEASE_KEY) || '';
  } catch (error) {
    storedRelease = '';
  }

  const clearLegacyData = async () => {
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

    return { registrations, cacheKeys };
  };

  const recoverAssets = async reason => {
    try {
      if (sessionStorage.getItem(RECOVERY_KEY) === RELEASE) return;
      sessionStorage.setItem(RECOVERY_KEY, RELEASE);
    } catch (error) {
      // Continue even when sessionStorage is unavailable.
    }
    await clearLegacyData();
    const recoveryUrl = new URL(window.location.href);
    recoveryUrl.searchParams.set('cachev', RELEASE);
    recoveryUrl.searchParams.set('assetreset', reason || 'asset-error');
    window.location.replace(recoveryUrl.toString());
  };

  window.DoseCacheRecovery = { release: RELEASE, recover: recoverAssets };

  window.__DOSE_CACHE_READY__ = (async () => {
    if (!forcedReset && storedRelease === RELEASE) return { cleaned:false, release:RELEASE };

    const { registrations, cacheKeys } = await clearLegacyData();

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
