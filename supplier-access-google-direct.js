(() => {
  const base = window.DoseSupplierAccess;
  if (!base || window.__DOSE_GOOGLE_DIRECT__) return;
  window.__DOSE_GOOGLE_DIRECT__ = true;
  const ADMIN_EMAIL = 'marco.tranquilli@dos.design';
  const norm = v => String(v || '').trim().toLowerCase();
  const originalResolve = base.resolveSession.bind(base);

  const first = (...values) => values.find(v => String(v || '').trim());
  function buildSession(user, result) {
    const token = result?._tokenResponse || {};
    const provider = (user?.providerData || [])[0] || {};
    const email = norm(first(user?.email, provider.email, token.email));
    const uid = first(user?.uid, token.localId, provider.uid);
    if (!email || !uid) return null;
    const isAdmin = email === ADMIN_EMAIL;
    const session = {
      uid,
      name: first(user?.displayName, provider.displayName, token.displayName, email.split('@')[0]),
      email,
      role: isAdmin ? 'admin' : 'user',
      isAdmin,
      provider: 'google.com'
    };
    localStorage.setItem('dose_user', JSON.stringify(session));
    return session;
  }

  async function firebaseAuth() {
    try { await originalResolve(); } catch (error) {}
    const [appSdk, authSdk] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js')
    ]);
    const app = appSdk.getApps().find(a => a.name === '[DEFAULT]');
    if (!app) throw new Error('Firebase non inizializzato: controlla configurazione app web.');
    return { auth: authSdk.getAuth(app), authSdk };
  }

  async function signInWithGoogle() {
    const { auth, authSdk } = await firebaseAuth();
    const provider = new authSdk.GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    const result = await authSdk.signInWithPopup(auth, provider);
    const session = buildSession(result?.user || auth.currentUser, result);
    if (!session) {
      const u = result?.user || auth.currentUser || {};
      const p = (u.providerData || [])[0] || {};
      throw new Error(`Sessione Google incompleta: uid=${!!u.uid}, email=${!!u.email}, provider=${p.providerId || 'n/d'}, tokenEmail=${!!result?._tokenResponse?.email}`);
    }
    return session;
  }

  async function resolveSession() {
    const { auth } = await firebaseAuth();
    const session = buildSession(auth.currentUser, null);
    if (session) return session;
    return originalResolve();
  }

  window.DoseSupplierAccess = Object.freeze({ ...base, signInWithGoogle, resolveSession });
})();
