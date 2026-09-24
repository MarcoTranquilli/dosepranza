(function initDoseDiagnostics(global) {
  'use strict';

  async function getServiceWorkerStatus() {
    if (!('serviceWorker' in navigator)) return 'unsupported';
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) return 'not-registered';
      if (registration.active) return 'active';
      if (registration.waiting) return 'waiting';
      if (registration.installing) return 'installing';
      return 'registered';
    } catch (_) {
      return 'unavailable';
    }
  }

  global.DoseDiagnostics = {
    async getSystemDiagnostics() {
      return {
        capturedAt: new Date().toISOString(),
        url: global.location.href.slice(0, 1000),
        screenResolution: `${global.screen.width}x${global.screen.height}`,
        viewport: `${global.innerWidth}x${global.innerHeight}`,
        userAgent: navigator.userAgent.slice(0, 500),
        language: navigator.language || '',
        online: navigator.onLine,
        serviceWorkerStatus: await getServiceWorkerStatus(),
        swResetQueryPresent: new URLSearchParams(global.location.search).has('swreset'),
      };
    },
  };
})(window);
