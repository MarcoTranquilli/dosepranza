(() => {
  const $ = id => document.getElementById(id);
  const ADMIN = 'marco.tranquilli@dos.design';
  const status = $('hub-auth-status');
  const btn = $('hub-google-login');
  const admin = $('admin-actions');
  const set = msg => { if (status) status.textContent = msg; };
  const norm = v => String(v || '').trim().toLowerCase();
  const first = (...v) => v.find(x => String(x || '').trim());

  function session(user, result) {
    const t = result?._tokenResponse || {};
    const p = (user?.providerData || [])[0] || {};
    const email = norm(first(user?.email, p.email, t.email));
    const uid = first(user?.uid, t.localId, p.uid);
    if (!email || !uid) return null;
    const isAdmin = email === ADMIN;
    const s = { uid, name: first(user?.displayName, p.displayName, t.displayName, email.split('@')[0]), email, role: isAdmin ? 'admin' : 'user', isAdmin, provider: 'google.com' };
    localStorage.setItem('dose_user', JSON.stringify(s));
    return s;
  }

  async function authKit() {
    try { await window.DoseSupplierAccess?.resolveSession?.(); } catch (e) {}
    const [appSdk, authSdk] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js')
    ]);
    const app = appSdk.getApps().find(a => a.name === '[DEFAULT]');
    if (!app) throw new Error('Firebase non inizializzato. Verifica che supplier-access.js sia caricato.');
    return { auth: authSdk.getAuth(app), authSdk };
  }

  async function waitUser(auth, authSdk) {
    if (typeof auth.authStateReady === 'function') await auth.authStateReady();
    else await new Promise(resolve => {
      const off = authSdk.onAuthStateChanged(auth, () => { off(); resolve(); }, () => resolve());
    });
    return auth.currentUser;
  }

  async function finish(s) {
    set(`Accesso completato: ${s.email}`);
    if (s.isAdmin) { document.body.classList.add('is-admin'); if (admin) admin.hidden = false; return; }
    location.replace('./russo/index.html?v=google-final-1');
  }

  async function start() {
    btn.disabled = true;
    set('Accesso Google in corso...');
    try {
      const { auth, authSdk } = await authKit();
      const provider = new authSdk.GoogleAuthProvider();
      provider.addScope('email'); provider.addScope('profile'); provider.setCustomParameters({ prompt: 'select_account' });
      let result = null;
      try { result = await authSdk.signInWithPopup(auth, provider); }
      catch (e) {
        if (!['auth/popup-blocked','auth/popup-closed-by-user','auth/cancelled-popup-request'].includes(e.code)) throw e;
        sessionStorage.setItem('dose_google_redirect', '1');
        await authSdk.signInWithRedirect(auth, provider); return;
      }
      const s = session(result?.user || await waitUser(auth, authSdk), result);
      if (!s) throw new Error('Sessione incompleta: popup riuscito ma Firebase non ha restituito uid/email. Controlla provider Google e domini autorizzati.');
      await finish(s);
    } catch (e) { set(`Accesso Google non riuscito. Dettaglio tecnico: ${e.code || e.name || 'Error'} · ${e.message || e}`); }
    finally { btn.disabled = false; }
  }

  async function boot() {
    try {
      const { auth, authSdk } = await authKit();
      const rr = await authSdk.getRedirectResult(auth).catch(() => null);
      const s = session(rr?.user || await waitUser(auth, authSdk), rr);
      if (s && sessionStorage.getItem('dose_google_redirect')) { sessionStorage.removeItem('dose_google_redirect'); await finish(s); return; }
      if (s) set(`Sessione attiva: ${s.email}`);
    } catch (e) { set('Pronto per accesso Google.'); }
    btn?.addEventListener('click', start);
  }
  boot();
})();