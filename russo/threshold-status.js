(() => {
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
      const result = await visible[0][1].getSummary();
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
  async function read(db, {sdk, now = new Date()} = {}) {
    if (!db) throw new Error('firestore_unavailable');
    const fs = sdk || await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
    const analytics = window.DoseOrderAnalytics;
    const range = analytics.rangeFor('today', now);
    const baseline = analytics.russoThreshold([], {now});
    const query = fs.query(fs.collection(db, 'orders'), fs.where('supplierId', '==', 'russo'),
      fs.where('createdAt', '>=', range.startDate), fs.where('createdAt', '<', new Date(baseline.cutoff)),
      fs.orderBy('createdAt', 'desc'), fs.limit(1001));
    const snapshot = await fs.getDocsFromServer(query);
    if (snapshot.size > 1000) throw new Error('summary_limit');
    return {...analytics.russoThreshold(snapshot.docs.map(doc => ({...doc.data(), id:doc.id})), {now}), asOf:now.toISOString()};
  }
  window.DoseRussoThreshold = Object.freeze({mount(element, {visible = () => true, getSummary} = {}) {
    if (!element) return;
    targets.set(element, {visible, getSummary}); refresh();
  }, refresh, read});
  setInterval(() => { if (!document.hidden) refresh(); }, 15000);
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', refresh);
})();
