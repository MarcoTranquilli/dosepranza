(() => {
  const base = window.DoseSupplierAccess;
  if (!base || window.__DOSE_GOOGLE_REPAIR__) return;
  window.__DOSE_GOOGLE_REPAIR__ = true;

  const ADMIN_EMAIL = 'marco.tranquilli@dos.design';
  const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

  function storeFirebaseUser(firebaseUser) {
    if (!firebaseUser || firebaseUser.isAnonymous || !firebaseUser.email) return null;
    const email = normalizeEmail(firebaseUser.email);
    const isAdmin = email === ADMIN_EMAIL;
    const session = {
      uid: firebaseUser.uid || '',
      name: firebaseUser.displayName || email.split('@')[0],
      email,
      role: isAdmin ? 'admin' : 'user',
      isAdmin,
      provider: 'google.com'
    };
    window.localStorage.setItem('dose_user', JSON.stringify(session));
    return session;
  }

  async function currentFirebaseSession() {
    const [appSdk, authSdk] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js')
    ]);
    const app = appSdk.getApps().find(candidate => candidate.name === '[DEFAULT]');
    if (!app) return null;
    const auth = authSdk.getAuth(app);
    if (typeof auth.authStateReady === 'function') await auth.authStateReady();
    return storeFirebaseUser(auth.currentUser);
  }

  const originalSignIn = base.signInWithGoogle.bind(base);
  const originalResolve = base.resolveSession.bind(base);

  async function signInWithGoogle() {
    try {
      return await originalSignIn();
    } catch (error) {
      const message = String(error?.message || '');
      const isStrictProviderRejection = message.includes('autenticato tramite Google');
      if (!isStrictProviderRejection) throw error;
      const session = await currentFirebaseSession();
      if (session) return session;
      throw error;
    }
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
