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
  const GOOGLE_PROVIDER_ID = 'google.com';
  const GOOGLE_CLIENT_ID = '553169964686-0d7l4u9sbkm7u8ej9r1fa4uchgi6e767.apps.googleusercontent.com';
  const GOOGLE_IDENTITY_SCRIPT_ID = 'dose-google-identity-services';
  const SETTINGS_KEY = 'dose_supplier_settings';
  const LOCAL_ORDERS_KEY = 'dose_e2e_pagnottella_orders';
  const DEFAULT_SETTINGS = Object.freeze({
    russo: Object.freeze({ enabledForUsers: true }),
    pagnottella: Object.freeze({ enabledForUsers: false })
  });

  let firebaseCorePromise = null;
  let firestorePromise = null;
  let googleIdentityPromise = null;

  const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
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
    const claimRole = tokenResult?.claims?.role;
    const isAdmin = email === ADMIN_EMAIL || claimRole === 'admin';
    return storeUser({
      uid: firebaseUser.uid,
      name: firebaseUser.displayName || email.split('@')[0],
      email,
      role: isAdmin ? 'admin' : (['user', 'ristoratore', 'facility'].includes(claimRole) ? claimRole : 'user'),
      isAdmin,
      provider: GOOGLE_PROVIDER_ID
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

  function loadGoogleIdentityServices() {
    if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
    if (googleIdentityPromise) return googleIdentityPromise;

    googleIdentityPromise = new Promise((resolve, reject) => {
      const existing = document.getElementById(GOOGLE_IDENTITY_SCRIPT_ID);
      const script = existing || document.createElement('script');
      const timeout = window.setTimeout(() => reject(new Error('Google Identity Services non disponibile.')), 10000);
      const complete = () => {
        window.clearTimeout(timeout);
        if (window.google?.accounts?.id) resolve(window.google.accounts.id);
        else reject(new Error('Google Identity Services non disponibile.'));
      };
      const fail = () => {
        window.clearTimeout(timeout);
        reject(new Error('Impossibile caricare Google Identity Services.'));
      };

      script.addEventListener('load', complete, { once: true });
      script.addEventListener('error', fail, { once: true });
      if (!existing) {
        script.id = GOOGLE_IDENTITY_SCRIPT_ID;
        script.src = 'https://accounts.google.com/gsi/client?hl=it';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
    }).catch((error) => {
      googleIdentityPromise = null;
      throw error;
    });

    return googleIdentityPromise;
  }

  async function renderGoogleSignInButton(element, callback) {
    if (!element || typeof callback !== 'function') throw new Error('Configurazione Google Login non valida.');
    const googleIdentity = await loadGoogleIdentityServices();
    element.replaceChildren();
    googleIdentity.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback,
      auto_select: false,
      cancel_on_tap_outside: true,
      context: 'signin',
      itp_support: true,
      ux_mode: 'popup',
      use_fedcm_for_button: true
    });
    googleIdentity.renderButton(element, {
      type: 'standard',
      theme: 'filled_black',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      logo_alignment: 'left',
      locale: 'it',
      width: 250
    });
    if (!element.childElementCount) throw new Error('Pulsante Google non disponibile.');
  }

  async function signInWithGoogleCredential(idToken) {
    const token = String(idToken || '').trim();
    if (token.split('.').length !== 3) throw new Error('Credenziale Google non valida.');
    const { auth, authSdk } = await loadFirebaseCore();
    const credential = authSdk.GoogleAuthProvider.credential(token);
    const result = await authSdk.signInWithCredential(auth, credential);
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
    DEFAULT_SETTINGS,
    isFilePreview,
    isE2E,
    isTrustedLocalContext,
    getStoredUser,
    resolveSession,
    signInWithGoogle,
    renderGoogleSignInButton,
    signInWithGoogleCredential,
    getSupplierSettings,
    setSupplierEnabled,
    canAccessSupplier,
    createPagnottellaOrder
  });
})();
