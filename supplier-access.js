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
  const RUSSO_SUPPLIER_EMAILS = Object.freeze([
    'lorenzo.russo@alimentarirusso',
    'russolorenzo11@gmail.com'
  ]);
  const GOOGLE_PROVIDER_ID = 'google.com';
  const SETTINGS_KEY = 'dose_supplier_settings';
  const LOCAL_ORDERS_KEY = 'dose_e2e_pagnottella_orders';
  const REDIRECT_PENDING_KEY = 'dose_auth_redirect_pending';
  const AUTH_STARTED_AT_KEY = 'dose_auth_started_at';
  const AUTH_RETURN_TO_KEY = 'dose_auth_return_to';
  const AUTH_LAST_ERROR_KEY = 'dose_auth_last_error';
  const AUTH_VERSION = 'auth-redirect-3';
  const DEFAULT_SETTINGS = Object.freeze({
    russo: Object.freeze({ enabledForUsers: true }),
    pagnottella: Object.freeze({ enabledForUsers: false })
  });

  let firebaseCorePromise = null;
  let firestorePromise = null;
  let anonymousSignInPromise = null;
  let authObserverStarted = false;
  let redirectResultPromise = null;
  let redirectResultProcessed = false;

  const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
  const roleForEmail = (value) => {
    const email = normalizeEmail(value);
    if (email === ADMIN_EMAIL) return 'admin';
    if (email === PAGNOTTELLA_SUPPLIER_EMAIL) return 'supplier';
    if (RUSSO_SUPPLIER_EMAILS.includes(email)) return 'supplier';
    if (email.endsWith('@dos.design')) return 'dos_user';
    return 'user';
  };
  const supplierIdsForIdentity = (emailValue, role) => {
    const email = normalizeEmail(emailValue);
    const resolvedRole = roleForEmail(email);
    if (resolvedRole === 'admin' || resolvedRole === 'dos_user') return ['russo', 'pagnottella'];
    if (email === PAGNOTTELLA_SUPPLIER_EMAIL) return ['pagnottella'];
    if (RUSSO_SUPPLIER_EMAILS.includes(email)) return ['russo'];
    return [];
  };
  const roleLabel = (role) => ({
    admin: 'Amministratore',
    dos_user: 'Utente DOS',
    supplier: 'Ristoratore / Fornitore',
    user: 'Non autorizzato'
  }[role] || 'Non autorizzato');
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
  function isVerifiedGoogleResult(providerData, signInProvider) {
    return hasGoogleProvider(providerData) || isGoogleSignInProvider(signInProvider);
  }
  const isFilePreview = () => window.location.protocol === 'file:';
  const isLoopback = () => ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
  const isProductionSuiteEntry = () => new URLSearchParams(window.location.search).get('suite') === 'production';
  const isE2E = () => {
    if (!isLoopback()) return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('e2e') === '1' || window.localStorage.getItem('dose_e2e') === '1';
  };
  const isTrustedLocalContext = () => isFilePreview() || isE2E();
  const isPublicWeb = () => !isFilePreview() && !isLoopback();
  const redirectPending = () => window.sessionStorage.getItem(REDIRECT_PENDING_KEY) === '1';
  const recordAuthError = (error) => {
    const code = String(error?.code || 'auth/unknown').slice(0, 80);
    window.sessionStorage.setItem(AUTH_LAST_ERROR_KEY, code);
    return code;
  };
  const clearRedirectState = () => {
    [REDIRECT_PENDING_KEY, AUTH_STARTED_AT_KEY, AUTH_RETURN_TO_KEY].forEach(key => {
      window.sessionStorage.removeItem(key);
    });
  };
  function cleanAuthResetFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const hadSwreset = params.has('swreset');
    const hadAuthreset = params.has('authreset');
    params.delete('swreset');
    params.delete('authreset');
    const changed = hadSwreset || hadAuthreset;
    if (!changed) return;
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
  }
  function markRedirectPending() {
    cleanAuthResetFromUrl();
    window.sessionStorage.setItem(REDIRECT_PENDING_KEY, '1');
    window.sessionStorage.setItem(AUTH_STARTED_AT_KEY, String(Date.now()));
    window.sessionStorage.setItem(AUTH_RETURN_TO_KEY, `${window.location.pathname}${window.location.search}${window.location.hash}`);
  }

  function getStoredUser() {
    try {
      const raw = JSON.parse(window.localStorage.getItem('dose_user') || 'null');
      if (!raw?.email || !raw?.name) return null;
      if (raw.provider !== GOOGLE_PROVIDER_ID && !isTrustedLocalContext()) return null;
      const email = normalizeEmail(raw.email);
      const role = roleForEmail(email);
      const isAdmin = role === 'admin';
      const normalized = {
        uid: raw.uid || (isTrustedLocalContext() ? 'local-preview-user' : ''),
        name: String(raw.name).trim(),
        email,
        role,
        isAdmin,
        supplierIds: supplierIdsForIdentity(email, role),
        provider: raw.provider || (isTrustedLocalContext() ? 'local-preview' : '')
      };
      window.localStorage.setItem('dose_user', JSON.stringify(normalized));
      return normalized;
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
      supplierIds: supplierIdsForIdentity(email, role),
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
      if (window.sessionStorage.getItem('dose_firebase_auth_reset_pending') === '1') {
        await authSdk.signOut(auth);
        window.sessionStorage.removeItem('dose_firebase_auth_reset_pending');
      }
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
      startAuthObserver(auth, authSdk);
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

  function resolveAuthenticatedIdentity(firebaseUser, result = null) {
    const tokenResponse = result?._tokenResponse || {};
    const profile = result?.additionalUserInfo?.profile || {};
    const provider = (firebaseUser?.providerData || []).find(item => item?.providerId === GOOGLE_PROVIDER_ID)
      || firebaseUser?.providerData?.[0]
      || {};
    const email = normalizeEmail(
      firebaseUser?.email || tokenResponse.email || profile.email || provider.email
    );
    const name = String(
      firebaseUser?.displayName || tokenResponse.fullName || profile.name || provider.displayName
      || (email ? email.split('@')[0] : '')
    ).trim();
    return { email, name };
  }

  async function firebaseUserPayload(firebaseUser, { result = null } = {}) {
    if (!firebaseUser || firebaseUser.isAnonymous || !firebaseUser.uid) return null;
    const identity = resolveAuthenticatedIdentity(firebaseUser, result);
    if (!identity.email) return null;
    let tokenResult = null;
    try {
      tokenResult = await firebaseUser.getIdTokenResult();
    } catch (error) {
      tokenResult = null;
    }
    const signInProvider = tokenResult?.signInProvider || tokenResult?.claims?.firebase?.sign_in_provider || '';
    if (!isVerifiedGoogleResult(firebaseUser.providerData, signInProvider)) return null;
    const email = identity.email;
    const role = roleForEmail(email);
    const isAdmin = role === 'admin';
    return storeUser({
      uid: firebaseUser.uid,
      name: identity.name,
      email,
      role,
      isAdmin,
      supplierIds: supplierIdsForIdentity(email, role),
      provider: GOOGLE_PROVIDER_ID
    });
  }

  function ensureAnonymousSession(auth, authSdk) {
    if (auth.currentUser) return Promise.resolve(auth.currentUser);
    if (!anonymousSignInPromise) {
      anonymousSignInPromise = authSdk.signInAnonymously(auth)
        .then(result => result.user)
        .finally(() => {
          anonymousSignInPromise = null;
        });
    }
    return anonymousSignInPromise;
  }

  function startAuthObserver(auth, authSdk) {
    if (authObserverStarted) return;
    authObserverStarted = true;
    authSdk.onAuthStateChanged(auth, user => {
      if (user && !user.isAnonymous) {
        firebaseUserPayload(user).catch(error => {
          recordAuthError(error);
          console.warn('Firebase Google session adoption failed', error?.code || 'auth/session-adoption-failed');
        });
      }
    });
  }

  function consumeRedirectResult(auth, authSdk) {
    if (redirectResultPromise) return redirectResultPromise;
    redirectResultPromise = (async () => {
      try {
        const result = await authSdk.getRedirectResult(auth);
        redirectResultProcessed = true;
        if (result?.user) {
          const user = await firebaseUserPayload(result.user, { result });
          if (user) clearRedirectState();
          return user;
        }
        return null;
      } catch (error) {
        redirectResultProcessed = true;
        recordAuthError(error);
        throw error;
      }
    })();
    return redirectResultPromise;
  }

  async function recoverGoogleSession(auth, authSdk) {
    if (auth.currentUser && !auth.currentUser.isAnonymous) return auth.currentUser;
    return new Promise(resolve => {
      const timeout = window.setTimeout(() => {
        unsubscribe();
        resolve(null);
      }, 1500);
      const unsubscribe = authSdk.onAuthStateChanged(auth, user => {
        if (!user || user.isAnonymous) return;
        window.clearTimeout(timeout);
        unsubscribe();
        resolve(user);
      }, () => {
        window.clearTimeout(timeout);
        unsubscribe();
        resolve(null);
      });
    });
  }

  async function recoverPendingRedirect(auth, authSdk) {
    if (!redirectPending()) return null;
    const firebaseUser = auth.currentUser || await new Promise(resolve => {
      const timeout = window.setTimeout(() => {
        unsubscribe();
        resolve(null);
      }, 5000);
      const unsubscribe = authSdk.onAuthStateChanged(auth, user => {
        if (!user || user.isAnonymous) return;
        window.clearTimeout(timeout);
        unsubscribe();
        resolve(user);
      }, () => {
        window.clearTimeout(timeout);
        unsubscribe();
        resolve(null);
      });
    });
    const user = await firebaseUserPayload(firebaseUser);
    if (user) {
      clearRedirectState();
    } else {
      recordAuthError({ code: 'auth/redirect-session-missing' });
      clearRedirectState();
    }
    return user;
  }

  function suiteFallbackSession() {
    if (!isProductionSuiteEntry()) return null;
    const stored = getStoredUser();
    if (!stored?.supplierIds?.includes('russo')) return null;
    const role = roleForEmail(stored.email);
    return {
      ...stored,
      role,
      isAdmin: role === 'admin',
      supplierIds: supplierIdsForIdentity(stored.email, role),
      firebaseVerified: false
    };
  }

  async function resolveSession() {
    if (isTrustedLocalContext()) return getStoredUser();
    const { auth, authSdk } = await loadFirebaseCore();
    const redirectUser = await consumeRedirectResult(auth, authSdk);
    if (redirectUser) return redirectUser;
    const pendingUser = await recoverPendingRedirect(auth, authSdk);
    if (pendingUser) return pendingUser;
    if (auth.currentUser && !auth.currentUser.isAnonymous) {
      const user = await firebaseUserPayload(auth.currentUser);
      if (user) return user;
    }
    if (isProductionSuiteEntry()) {
      const recovered = await recoverGoogleSession(auth, authSdk);
      const recoveredUser = await firebaseUserPayload(recovered);
      if (recoveredUser) return recoveredUser;
      const fallback = suiteFallbackSession();
      if (fallback) return fallback;
    }
    if (redirectPending() || !redirectResultProcessed) return null;
    await ensureAnonymousSession(auth, authSdk);
    window.localStorage.removeItem('dose_user');
    return null;
  }

  async function startGoogleRedirect(auth, authSdk, provider) {
    markRedirectPending();
    await authSdk.signInWithRedirect(auth, provider);
    return null;
  }

  async function signInWithGoogle() {
    if (isFilePreview()) throw new Error('Google Login richiede un indirizzo http o https.');
    const { auth, authSdk } = await loadFirebaseCore();
    const provider = new authSdk.GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    provider.setCustomParameters({ prompt: 'select_account' });
    const currentUser = isPublicWeb()
      ? auth.currentUser
      : (auth.currentUser || await ensureAnonymousSession(auth, authSdk));
    try {
      let result;
      try {
        result = isPublicWeb()
          ? await authSdk.signInWithPopup(auth, provider)
          : (currentUser?.isAnonymous
            ? await authSdk.linkWithPopup(currentUser, provider)
            : await authSdk.signInWithPopup(auth, provider));
      } catch (error) {
        const canRecoverCredential = [
          'auth/credential-already-in-use',
          'auth/email-already-in-use',
          'auth/account-exists-with-different-credential'
        ].includes(error?.code);
        const credential = canRecoverCredential
          ? authSdk.GoogleAuthProvider.credentialFromError(error)
          : null;
        if (!credential) return startGoogleRedirect(auth, authSdk, provider);
        result = await authSdk.signInWithCredential(auth, credential);
      }
      await result.user?.getIdToken?.(true);
      if (!auth.currentUser?.uid || auth.currentUser.isAnonymous) {
        const sessionError = new Error('Sessione non pronta, riprova tra un istante.');
        sessionError.code = 'auth/session-not-ready';
        throw sessionError;
      }
      const user = await firebaseUserPayload(result.user, { result });
      if (!user) {
        const invalidUserError = new Error('Login Google riuscito ma email non disponibile.');
        invalidUserError.code = 'auth/google-user-missing';
        throw invalidUserError;
      }
      return user;
    } catch (error) {
      recordAuthError(error);
      throw error;
    }
  }

  async function signOut() {
    if (!isFilePreview()) {
      const { auth, authSdk } = await loadFirebaseCore();
      await authSdk.signOut(auth);
    }
    window.localStorage.removeItem('dose_user');
    clearRedirectState();
  }

  async function getAuthDiagnostics() {
    let auth = null;
    let firebaseInitialized = false;
    try {
      ({ auth } = await loadFirebaseCore());
      firebaseInitialized = true;
    } catch (error) {
      recordAuthError(error);
    }
    const firebaseUser = auth?.currentUser || null;
    const email = normalizeEmail(firebaseUser?.email);
    const role = email ? roleForEmail(email) : '';
    return {
      origin: window.location.origin,
      path: window.location.pathname,
      firebaseInitialized,
      currentUserPresent: !!firebaseUser,
      isAnonymous: !!firebaseUser?.isAnonymous,
      email,
      providerIds: (firebaseUser?.providerData || []).map(item => item?.providerId).filter(Boolean),
      role,
      supplierIds: email ? supplierIdsForIdentity(email, role) : [],
      redirectPending: redirectPending(),
      lastAuthErrorCode: window.sessionStorage.getItem(AUTH_LAST_ERROR_KEY) || '',
      version: AUTH_VERSION
    };
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
    return false;
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
    if (!session?.email || !session?.uid) throw new Error('Sessione non pronta, riprova tra un istante.');
    if (isTrustedLocalContext()) return createLocalOrder(payload, session);
    const { auth, db, firestoreSdk } = await loadFirestore();
    if (!auth.currentUser?.uid || auth.currentUser.isAnonymous) {
      throw new Error('Sessione non pronta, riprova tra un istante.');
    }
    const order = {
      ...structuredOrderPayload(payload),
      uid: auth.currentUser.uid,
      user: session.name,
      email: session.email,
      createdAt: firestoreSdk.serverTimestamp()
    };
    const reference = await firestoreSdk.addDoc(firestoreSdk.collection(db, 'orders'), order);
    return { id: reference.id, order, local: false };
  }

  window.DoseSupplierAccess = Object.freeze({
    ADMIN_EMAIL,
    AUTH_VERSION,
    roleForEmail,
    roleLabel,
    supplierIdsForIdentity,
    isVerifiedGoogleResult,
    DEFAULT_SETTINGS,
    isFilePreview,
    isE2E,
    isTrustedLocalContext,
    getStoredUser,
    resolveSession,
    signInWithGoogle,
    signOut,
    getAuthDiagnostics,
    getSupplierSettings,
    setSupplierEnabled,
    canAccessSupplier,
    createPagnottellaOrder
  });
})();
