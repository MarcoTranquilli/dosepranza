(() => {
  const base = window.DoseSupplierAccess;
  if (!base || window.DoseSupplierAccessPagesHotfix) return;
  window.DoseSupplierAccessPagesHotfix = true;

  const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

  async function firebaseSessionFromCurrentUser() {
    try {
      const [appSdk, authSdk] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js')
      ]);
      const app = appSdk.getApps()[0];
      if (!app) return null;
      const auth = authSdk.getAuth(app);
      if (typeof auth.authStateReady === 'function') {
        await auth.authStateReady();
      } else {
        await new Promise((resolve) => {
          const unsubscribe = authSdk.onAuthStateChanged(auth, () => {
            unsubscribe();
            resolve();
          }, () => resolve());
        });
      }
      const user = auth.currentUser;
      if (!user || user.isAnonymous || !user.email) return null;
      const email = normalizeEmail(user.email);
      const session = {
        uid: user.uid,
        name: user.displayName || email.split('@')[0],
        email,
        role: email === base.ADMIN_EMAIL ? 'admin' : 'user',
        isAdmin: email === base.ADMIN_EMAIL,
        provider: 'google.com'
      };
      window.localStorage.setItem('dose_user', JSON.stringify(session));
      return session;
    } catch (error) {
      console.warn('pages auth hotfix session fallback failed', error);
      return null;
    }
  }

  async function writeSupplierSetting(supplierId, enabled) {
    if (!['russo', 'pagnottella'].includes(supplierId)) throw new Error('Fornitore non riconosciuto.');
    const session = await patched.resolveSession();
    if (!session?.isAdmin) throw new Error('Solo l’amministratore può modificare la visibilità dei fornitori.');
    const [appSdk, firestoreSdk] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js')
    ]);
    const app = appSdk.getApps()[0];
    if (!app) throw new Error('Firebase non inizializzato.');
    const db = firestoreSdk.getFirestore(app);
    await firestoreSdk.setDoc(firestoreSdk.doc(db, 'app_config', 'suppliers'), {
      [supplierId]: { enabledForUsers: !!enabled },
      updatedAt: firestoreSdk.serverTimestamp(),
      updatedBy: session.email
    }, { merge: true });
    return base.getSupplierSettings();
  }

  const patched = Object.freeze({
    ...base,
    async signInWithGoogle() {
      try {
        return await base.signInWithGoogle();
      } catch (error) {
        const session = await firebaseSessionFromCurrentUser();
        if (session) return session;
        throw error;
      }
    },
    async resolveSession() {
      try {
        const session = await base.resolveSession();
        if (session) return session;
      } catch (error) {
        console.warn('pages auth hotfix base session failed', error);
      }
      return firebaseSessionFromCurrentUser();
    },
    async setSupplierEnabled(supplierId, enabled) {
      try {
        return await base.setSupplierEnabled(supplierId, enabled);
      } catch (error) {
        return writeSupplierSetting(supplierId, enabled);
      }
    }
  });

  window.DoseSupplierAccess = patched;
})();