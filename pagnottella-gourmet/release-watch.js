(() => {
  const current = document.querySelector('meta[name="dose-release"]')?.content;
  const banner = document.getElementById('releaseNotice');
  const button = document.getElementById('releaseRefresh');
  const copy = document.getElementById('releaseCopy');
  if (!current || !banner || !button || !copy || !/^https?:$/.test(location.protocol)) return;
  const interval = 5 * 60 * 1000;
  let nextCheck = 0;
  let inFlight = false;
  let available = false;
  function updateButton() {
    if (!available) return;
    const safe = window.DoseCanReload?.() === true;
    button.disabled = !safe;
    copy.textContent = safe
      ? 'È disponibile una nuova versione di DOSepranza. Puoi aggiornare senza uscire dal tuo account.'
      : 'Nuova versione disponibile. Completa o svuota il carrello e chiudi le conferme prima di aggiornare: il carrello non viene ricaricato automaticamente.';
  }
  async function check() {
    if (inFlight || available || document.hidden || navigator.onLine === false || Date.now() < nextCheck) return;
    nextCheck = Date.now() + interval;
    inFlight = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch('./release.json', {cache:'no-store', credentials:'omit', signal:controller.signal});
      if (!response.ok) return;
      const release = await response.json();
      if (typeof release.version !== 'string' || !/^[a-z0-9.-]{1,64}$/.test(release.version) || release.version === current) return;
      available = true;
      banner.hidden = false;
      updateButton();
    } catch {
      // Update discovery must never block login, ordering or analytics.
    } finally { clearTimeout(timeout); inFlight = false; }
  }
  button.addEventListener('click', () => {
    updateButton();
    if (button.disabled || window.DoseCanReload?.() !== true) return;
    location.reload();
  });
  document.getElementById('releaseLater')?.addEventListener('click', () => { banner.hidden = true; });
  const observer = new MutationObserver(updateButton);
  ['cartCount', 'paymentConfirmModal', 'checkoutCompleteModal', 'sendOrderBtn', 'authGateGoogle'].forEach(id => {
    const element = document.getElementById(id);
    if (element) observer.observe(element, {attributes:true, childList:true, subtree:true});
  });
  document.addEventListener('visibilitychange', () => { updateButton(); check(); });
  window.addEventListener('online', check);
  window.addEventListener('pagnottella:session-changed', updateButton);
  setInterval(check, interval);
  check();
})();
