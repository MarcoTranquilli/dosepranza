(() => {
  const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyCQJsNbgaR89gF_1vLe6H4DPboOhQvm9nI',
    authDomain: 'app-ordini-pranzo-alimentari.firebaseapp.com',
    projectId: 'app-ordini-pranzo-alimentari',
    storageBucket: 'app-ordini-pranzo-alimentari.appspot.com',
    messagingSenderId: '553169964686',
    appId: '1:553169964686:web:7f8ca6f32a301949e4c3df'
  };

  const ADMIN_EMAIL = 'marco.tranquilli@dos.design';
  const SETTINGS_KEY = 'dose_supplier_settings';
  const LOCAL_ORDERS_KEY = 'dose_e2e_pagnottella_orders';
  const DEFAULT_SETTINGS = Object.freeze({
    russo: Object.freeze({ enabledForUsers: true }),
    pagnottella: Object.freeze({ enabledForUsers: false })
  });

  let firebaseCorePromise = null;
  let firestorePromise = null;

  const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
  const isFilePreview = () => window.location.protocol === 'file:';
  const isLoopback = () => ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
  const isE2E = () => {
    if (!isLoopback()) return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('e2e') === '1' || window.localStorage.getItem('dose_e2e') === '1';
  };
  const isTrustedLocalContext = () => isFilePreview() || isE2E();

  function getStoredUser() {
    try {
      const raw = JSON.parse(window.localStorage.getItem('dose_user') || 'null');
      if (!raw?.email || !raw?.name) return null;
      const email = normalizeEmail(raw.email);
      return {
        uid: raw.uid || (isTrustedLocalContext() ? 'local-preview-user' : ''),
        name: String(raw.name).trim(),
        email,
        role: email === ADMIN_EMAIL ? 'admin' : (raw.role || 'user'),
        isAdmin: email === ADMIN_EMAIL,
        provider: raw.provider || (isTrustedLocalContext() ? 'local-preview' : '')
      };
    } catch (error) {
      return null;
    }
  }

  function storeUser(user) {
    const safeUser = {
      uid: user.uid || '',
      name: String(user.name || '').trim(),
      email: normalizeEmail(user.email),
      role: user.isAdmin ? 'admin' : (user.role || 'user'),
      isAdmin: !!user.isAdmin,
      provider: user.provider || 'google.com'
    };
    window.localStorage.setItem('dose_user', JSON.stringify(safeUser));
    return safeUser;
  }

  async function loadFirebaseCore() {
    if (firebaseCorePromise) return firebaseCorePromise;
    firebaseCorePromise = (async () => {
      const [appSdk, authSdk] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js')
      ]);
      const app = appSdk.getApps().find(candidate => candidate.name === '[DEFAULT]') || appSdk.initializeApp(FIREBASE_CONFIG);
      const auth = authSdk.getAuth(app);
      await authSdk.setPersistence(auth, authSdk.browserLocalPersistence);
      if (typeof auth.authStateReady === 'function') {
        await auth.authStateReady();
      } else {
        await new Promise(resolve => {
          const unsubscribe = authSdk.onAuthStateChanged(auth, () => {
            unsubscribe();
            resolve();
          }, () => resolve());
        });
      }
      return { app, auth, authSdk };
    })();
    return firebaseCorePromise;
  }

  async function loadFirestore() {
    if (firestorePromise) return firestorePromise;
    firestorePromise = (async () => {
      const core = await loadFirebaseCore();
      const firestoreSdk = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
      return { ...core, firestoreSdk, db: firestoreSdk.getFirestore(core.app) };
    })();
    return firestorePromise;
  }

  async function firebaseUserPayload(firebaseUser) {
    if (!firebaseUser || firebaseUser.isAnonymous || !firebaseUser.email) return null;
    const providerIds = (firebaseUser.providerData || []).map(item => item?.providerId).filter(Boolean);
    let tokenResult = null;
    try {
      tokenResult = await firebaseUser.getIdTokenResult();
    } catch (error) {
      tokenResult = null;
    }
    const signInProvider = tokenResult?.signInProvider || tokenResult?.claims?.firebase?.sign_in_provider || '';
    if (!providerIds.includes('google.com') && signInProvider !== 'google.com') return null;
    const email = normalizeEmail(firebaseUser.email);
    const claimRole = tokenResult?.claims?.role;
    const isAdmin = email === ADMIN_EMAIL || claimRole === 'admin';
    return storeUser({
      uid: firebaseUser.uid,
      name: firebaseUser.displayName || email.split('@')[0],
      email,
      role: isAdmin ? 'admin' : (['user', 'ristoratore', 'facility'].includes(claimRole) ? claimRole : 'user'),
      isAdmin,
      provider: 'google.com'
    });
  }

  async function resolveSession() {
    if (isTrustedLocalContext()) return getStoredUser();
    const { auth } = await loadFirebaseCore();
    const user = await firebaseUserPayload(auth.currentUser);
    if (!user) window.localStorage.removeItem('dose_user');
    return user;
  }

  async function signInWithGoogle() {
    if (isFilePreview()) throw new Error('Google Login richiede un indirizzo http o https.');
    const { auth, authSdk } = await loadFirebaseCore();
    const provider = new authSdk.GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await authSdk.signInWithPopup(auth, provider);
    const user = await firebaseUserPayload(result.user);
    if (!user) throw new Error('L’account deve essere autenticato tramite Google.');
    return user;
  }

  function sanitizeSettings(value) {
    return {
      russo: { enabledForUsers: value?.russo?.enabledForUsers !== false },
      pagnottella: { enabledForUsers: value?.pagnottella?.enabledForUsers === true }
    };
  }

  function localSettings() {
    try {
      return sanitizeSettings(JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || 'null') || DEFAULT_SETTINGS);
    } catch (error) {
      return sanitizeSettings(DEFAULT_SETTINGS);
    }
  }

  async function getSupplierSettings() {
    if (isTrustedLocalContext()) return localSettings();
    const session = await resolveSession();
    if (!session) return sanitizeSettings(DEFAULT_SETTINGS);
    try {
      const { db, firestoreSdk } = await loadFirestore();
      const snapshot = await firestoreSdk.getDoc(firestoreSdk.doc(db, 'app_config', 'suppliers'));
      return sanitizeSettings(snapshot.exists() ? snapshot.data() : DEFAULT_SETTINGS);
    } catch (error) {
      console.warn('Supplier settings unavailable; secure defaults applied.', error);
      return sanitizeSettings(DEFAULT_SETTINGS);
    }
  }

  async function setSupplierEnabled(supplierId, enabled) {
    if (!['russo', 'pagnottella'].includes(supplierId)) throw new Error('Fornitore non riconosciuto.');
    const session = await resolveSession();
    if (!session?.isAdmin) throw new Error('Solo l’amministratore può modificare la visibilità dei fornitori.');
    if (isTrustedLocalContext()) {
      const settings = localSettings();
      settings[supplierId].enabledForUsers = !!enabled;
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      return settings;
    }
    const { db, firestoreSdk } = await loadFirestore();
    await firestoreSdk.setDoc(firestoreSdk.doc(db, 'app_config', 'suppliers'), {
      [supplierId]: { enabledForUsers: !!enabled },
      updatedAt: firestoreSdk.serverTimestamp(),
      updatedBy: session.email
    }, { merge: true });
    return getSupplierSettings();
  }

  async function canAccessSupplier(supplierId, session = null) {
    const currentSession = session || await resolveSession();
    if (!currentSession) return false;
    if (currentSession.isAdmin) return true;
    const settings = await getSupplierSettings();
    return settings[supplierId]?.enabledForUsers === true;
  }

  function createLocalOrder(payload, session) {
    const id = payload.clientOrderId || window.crypto?.randomUUID?.() || `pg-${Date.now()}`;
    const order = {
      ...payload,
      id,
      uid: session.uid,
      user: session.name,
      email: session.email,
      createdAt: new Date().toISOString()
    };
    let orders = [];
    try {
      orders = JSON.parse(window.localStorage.getItem(LOCAL_ORDERS_KEY) || '[]');
    } catch (error) {
      orders = [];
    }
    orders.unshift(order);
    window.localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(orders.slice(0, 50)));
    return { id, order, local: true };
  }

  async function createPagnottellaOrder(payload) {
    if (!Array.isArray(payload?.items) || payload.items.length === 0) throw new Error('Il carrello è vuoto.');
    if (!Number.isFinite(Number(payload.total)) || Number(payload.total) < 0) throw new Error('Totale ordine non valido.');
    const session = await resolveSession();
    if (!session?.email || !session?.uid) throw new Error('Sessione Google non disponibile. Accedi nuovamente.');
    if (isTrustedLocalContext()) return createLocalOrder(payload, session);
    const { db, firestoreSdk } = await loadFirestore();
    const order = {
      ...payload,
      supplierId: 'pagnottella',
      supplierName: 'La Pagnottella Gourmet',
      uid: session.uid,
      user: session.name,
      email: session.email,
      createdAt: firestoreSdk.serverTimestamp()
    };
    const reference = await firestoreSdk.addDoc(firestoreSdk.collection(db, 'orders'), order);
    return { id: reference.id, order, local: false };
  }

  window.DoseSupplierAccess = Object.freeze({
    ADMIN_EMAIL,
    DEFAULT_SETTINGS,
    isFilePreview,
    isE2E,
    isTrustedLocalContext,
    getStoredUser,
    resolveSession,
    signInWithGoogle,
    getSupplierSettings,
    setSupplierEnabled,
    canAccessSupplier,
    createPagnottellaOrder
  });
})();
