(() => {
  const base = window.DoseSupplierAccess;
  if (!base || window.__DOSE_GOOGLE_REPAIR__) return;
  window.__DOSE_GOOGLE_REPAIR__ = true;

  const ADMIN_EMAIL = 'marco.tranquilli@dos.design';
  const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
  const originalResolve = base.resolveSession.bind(base);

  function storeFirebaseUser(firebaseUser) {
    if (!firebaseUser || firebaseUser.isAnonymous || !firebaseUser.email || !firebaseUser.uid) return null;
    const email = normalizeEmail(firebaseUser.email);
    const isAdmin = email === ADMIN_EMAIL;
    const session = {
      uid: firebaseUser.uid,
      name: firebaseUser.displayName || email.split('@')[0],
      email,
      role: isAdmin ? 'admin' : 'user',
      isAdmin,
      provider: 'google.com'
    };
    localStorage.setItem('dose_user', JSON.stringify(session));
    return session;
  }

  async function firebaseAuth() {
    try { await originalResolve(); } catch (error) { /* original validation may fail; init still happens */ }
    const [appSdk, authSdk] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js')
    ]);
    const app = appSdk.getApps().find(candidate => candidate.name === '[DEFAULT]');
    if (!app) throw new Error('Firebase non inizializzato. Ricarica la pagina e riprova.');
    const auth = authSdk.getAuth(app);
    return { auth, authSdk };
  }

  async function currentFirebaseSession() {
    const { auth, authSdk } = await firebaseAuth();
    if (typeof auth.authStateReady === 'function') await auth.authStateReady();
    else await new Promise(resolve => {
      const unsubscribe = authSdk.onAuthStateChanged(auth, () => { unsubscribe(); resolve(); }, () => resolve());
    });
    return storeFirebaseUser(auth.currentUser);
  }

  async function signInWithGoogle() {
    if (base.isFilePreview?.()) throw new Error('Google Login richiede un indirizzo http o https.');
    const { auth, authSdk } = await firebaseAuth();
    const provider = new authSdk.GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await authSdk.signInWithPopup(auth, provider);
    const session = storeFirebaseUser(result.user || auth.currentUser);
    if (!session) throw new Error('Sessione Google non disponibile dopo il popup.');
    return session;
  }

  async function resolveSession() {
    const session = await currentFirebaseSession();
    if (session) return session;
    return originalResolve();
  }

  window.DoseSupplierAccess = Object.freeze({
    ...base,
    signInWithGoogle,
    resolveSession
  });
})();