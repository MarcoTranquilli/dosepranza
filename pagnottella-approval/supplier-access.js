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
  const PAGNOTTELLA_SUPPLIER_EMAIL = 'commerciale@lapagnottellagourmet.it';
  const GOOGLE_PROVIDER_ID = 'google.com';
  const SETTINGS_KEY = 'dose_supplier_settings';
  const LOCAL_ORDERS_KEY = 'dose_e2e_pagnottella_orders';
  const DEFAULT_SETTINGS = Object.freeze({
    russo: Object.freeze({ enabledForUsers: true }),
    pagnottella: Object.freeze({ enabledForUsers: false })
  });

  let firebaseCorePromise = null;
  let firestorePromise = null;
  let redirectResultPromise = null;

  const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
  const roleForEmail = (value) => {
    const email = normalizeEmail(value);
    if (email === ADMIN_EMAIL) return 'admin';
    if (email === PAGNOTTELLA_SUPPLIER_EMAIL) return 'supplier';
    return 'user';
  };
  function isGoogleProviderId(providerId) {
    return providerId === GOOGLE_PROVIDER_ID;
  }
  function hasGoogleProvider(providerData) {
    return (providerData || [])
      .map(item => item?.providerId)
      .filter(Boolean)
      .some(isGoogleProviderId);
  }
  function isGoogleSignInProvider(signInProvider) {
    return signInProvider === GOOGLE_PROVIDER_ID;
  }
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
      if (raw.provider !== GOOGLE_PROVIDER_ID && !isTrustedLocalContext()) return null;
      const email = normalizeEmail(raw.email);
      const role = roleForEmail(email);
      const isAdmin = role === 'admin';
      return {
        uid: raw.uid || (isTrustedLocalContext() ? 'local-preview-user' : ''),
        name: String(raw.name).trim(),
        email,
        role,
        isAdmin,
        supplierIds: role === 'supplier' ? ['pagnottella'] : [],
        provider: raw.provider || (isTrustedLocalContext() ? 'local-preview' : '')
      };
    } catch (error) {
      return null;
    }
  }

  function storeUser(user) {
    const email = normalizeEmail(user.email);
    const role = roleForEmail(email);
    const isAdmin = role === 'admin';
    const safeUser = {
      uid: user.uid || '',
      name: String(user.name || '').trim(),
      email,
      role,
      isAdmin,
      supplierIds: role === 'supplier' ? ['pagnottella'] : [],
      provider: user.provider || GOOGLE_PROVIDER_ID
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
    let tokenResult = null;
    try {
      tokenResult = await firebaseUser.getIdTokenResult();
    } catch (error) {
      tokenResult = null;
    }
    const signInProvider = tokenResult?.signInProvider || tokenResult?.claims?.firebase?.sign_in_provider || '';
    if (!hasGoogleProvider(firebaseUser.providerData) && !isGoogleSignInProvider(signInProvider)) return null;
    const email = normalizeEmail(firebaseUser.email);
    const role = roleForEmail(email);
    const isAdmin = role === 'admin';
    return storeUser({
      uid: firebaseUser.uid,
      name: firebaseUser.displayName || email.split('@')[0],
      email,
      role,
      isAdmin,
      supplierIds: role === 'supplier' ? ['pagnottella'] : [],
      provider: GOOGLE_PROVIDER_ID
    });
  }

  async function consumeRedirectResult() {
    if (isFilePreview()) return null;
    if (!redirectResultPromise) {
      redirectResultPromise = (async () => {
        const { auth, authSdk } = await loadFirebaseCore();
        const result = await authSdk.getRedirectResult(auth);
        return result?.user ? firebaseUserPayload(result.user) : null;
      })();
    }
    return redirectResultPromise;
  }

  async function resolveSession() {
    if (isTrustedLocalContext()) return getStoredUser();
    const { auth } = await loadFirebaseCore();
    const redirectedUser = await consumeRedirectResult();
    if (redirectedUser) return redirectedUser;
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
    try {
      const result = await authSdk.signInWithPopup(auth, provider);
      const user = await firebaseUserPayload(result.user);
      if (!user) throw new Error('L’account deve essere autenticato tramite Google.');
      return user;
    } catch (error) {
      const redirectFallbackCodes = [
        'auth/popup-blocked',
        'auth/operation-not-supported-in-this-environment',
        'auth/web-storage-unsupported'
      ];
      if (!redirectFallbackCodes.includes(error?.code)) throw error;
      await authSdk.signInWithRedirect(auth, provider);
      return null;
    }
  }

  async function signOut() {
    if (!isFilePreview()) {
      const { auth, authSdk } = await loadFirebaseCore();
      await authSdk.signOut(auth);
    }
    window.localStorage.removeItem('dose_user');
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
    if (currentSession.supplierIds?.includes(supplierId)) return true;
    const settings = await getSupplierSettings();
    return settings[supplierId]?.enabledForUsers === true;
  }

  function structuredOrderPayload(payload, includeAllergies = true) {
    const structured = {
      clientOrderId: payload.clientOrderId,
      source: payload.source,
      supplierId: 'pagnottella',
      supplierName: 'La Pagnottella Gourmet',
      company: payload.company,
      deliveryAddress: payload.deliveryAddress,
      pointOfSale: payload.pointOfSale,
      serviceWindow: payload.serviceWindow,
      items: payload.items,
      subtotalOriginal: payload.subtotalOriginal,
      discountRate: payload.discountRate,
      discountAmount: payload.discountAmount,
      total: payload.total,
      paymentMethod: payload.paymentMethod,
      paymentStatus: payload.paymentStatus,
      orderStatus: payload.orderStatus,
      orderType: payload.orderType,
      reconciled: payload.reconciled
    };
    if (includeAllergies) structured.allergies = String(payload.allergies || '').trim();
    return structured;
  }

  function createLocalOrder(payload, session) {
    const id = payload.clientOrderId || window.crypto?.randomUUID?.() || `pg-${Date.now()}`;
    const structured = structuredOrderPayload(payload, false);
    const hasNotesOrAllergies = Boolean(String(payload.allergies || '').trim());
    const order = {
      ...structured,
      hasNotesOrAllergies,
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
      ...structuredOrderPayload(payload),
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
    roleForEmail,
    DEFAULT_SETTINGS,
    isFilePreview,
    isE2E,
    isTrustedLocalContext,
    getStoredUser,
    resolveSession,
    signInWithGoogle,
    signOut,
    getSupplierSettings,
    setSupplierEnabled,
    canAccessSupplier,
    createPagnottellaOrder
  });
})();
