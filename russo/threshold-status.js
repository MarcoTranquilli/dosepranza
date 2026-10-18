(() => {
  const endpoint = 'https://app-dosepranza.netlify.app/.netlify/functions/russo-threshold';
  const targets = new Map();
  let generation = 0, activeIdentity = '', pending = false, lastRead = 0;
  const money = cents => new Intl.NumberFormat('it-IT', {style:'currency', currency:'EUR'}).format(cents / 100);
  function paint(element, result) {
    element.hidden = false;
    element.className = 'russoThreshold';
    delete element.dataset.state;
    element.replaceChildren();
    const heading = document.createElement('strong');
    heading.textContent = 'Alimentari Russo · soglia collettiva di oggi';
    const text = document.createElement('p');
    if (!result) {
      text.textContent = 'Riepilogo collettivo non disponibile. La conferma della soglia non è ancora verificata.';
      element.append(heading, text); return;
    }
    element.dataset.state = result.status;
    text.textContent = result.status === 'STATO_CONFERMATO' ? 'Soglia raggiunta: ordini confermati.'
      : result.status === 'STATO_NON_CONFERMATO' ? 'Ordini non confermati: soglia non raggiunta entro le 10:30.'
      : `In attesa: mancano ${money(result.missingCents)} alla conferma.`;
    const progress = document.createElement('progress');
    progress.max = result.thresholdCents; progress.value = Math.min(result.totalCents, progress.max);
    progress.setAttribute('aria-label', 'Totale collettivo ordini Russo');
    const amount = document.createElement('small');
    amount.textContent = `${money(result.totalCents)} / ${money(result.thresholdCents)} · ${result.day} · entro le 10:30, ora italiana`;
    element.append(heading, text, progress, amount);
  }
  async function refresh() {
    const user = window.DoseSupplierAccess?.getStoredUser?.();
    const email = String(user?.email || '').trim().toLowerCase();
    const identity = `${user?.uid || ''}:${email}`;
    if (identity !== activeIdentity) {
      generation++; activeIdentity = identity; pending = false; lastRead = 0;
      targets.forEach((_, el) => { el.replaceChildren(); el.hidden = true; });
    }
    const visible = [...targets].filter(([el, options]) => el.isConnected && options.visible() && email.endsWith('@dos.design'));
    targets.forEach((options, el) => { el.hidden = !visible.some(([target]) => target === el); });
    if (!visible.length || pending || Date.now() - lastRead < 15000) return;
    pending = true;
    const ticket = generation;
    try {
      const token = await visible[0][1].getToken();
      if (!token) throw new Error('session_unavailable');
      const response = await fetch(endpoint, {headers:{Authorization:`Bearer ${token}`}, signal:AbortSignal.timeout(10000), cache:'no-store'});
      if (!response.ok) throw new Error('summary_unavailable');
      const result = await response.json();
      if (result.supplierId !== 'russo' || !['STATO_CONFERMATO','STATO_IN_ATTESA','STATO_NON_CONFERMATO'].includes(result.status)
        || !Number.isSafeInteger(result.totalCents) || result.totalCents < 0 || result.thresholdCents !== 2000
        || !Number.isSafeInteger(result.missingCents) || !Number.isFinite(Date.parse(result.asOf))
        || Math.abs(Date.now() - Date.parse(result.asOf)) > 60000) throw new Error('invalid_summary');
      if (ticket === generation) visible.forEach(([el]) => paint(el, result));
    } catch {
      if (ticket === generation) visible.forEach(([el]) => paint(el, null));
    } finally {
      if (ticket === generation) { pending = false; lastRead = Date.now(); }
    }
  }
  async function currentToken() {
    const [apps, auth] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js')
    ]);
    const app = apps.getApps()[0];
    return app ? auth.getAuth(app).currentUser?.getIdToken() : null;
  }
  window.DoseRussoThreshold = Object.freeze({mount(element, {visible = () => true, getToken = currentToken} = {}) {
    if (!element) return;
    targets.set(element, {visible, getToken}); refresh();
  }, refresh});
  setInterval(() => { if (!document.hidden) refresh(); }, 15000);
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', refresh);
})();
