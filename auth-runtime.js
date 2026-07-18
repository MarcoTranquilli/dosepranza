(() => {
  'use strict';
  const base = window.DoseSupplierAccess;
  if (!base) throw new Error('DOSepranza: modulo Firebase non disponibile.');

  const RELEASE = '20260718.2';
  const NEXT_KEY = 'dose_auth_next';
  const RELEASE_KEY = 'dose_release';
  const APP_PATH = (() => {
    try { return new URL('.', document.currentScript?.src || location.href).pathname; }
    catch { return '/dosepranza/'; }
  })();
  const OWN_KEYS = new Set([
    'dose_user', NEXT_KEY, RELEASE_KEY, 'dose_supplier_settings', 'dose_e2e',
    'dose_redirect', 'dose_preview_admin', 'dose_preview_mode',
    'dose_preview_pagnottella_orders', 'pg_order_logs'
  ]);
  let corePromise;

  const normalize = (value) => String(value || '').trim().toLowerCase();
  const safeStorage = (store) => {
    try { store.setItem('__dose_probe', '1'); store.removeItem('__dose_probe'); return store; }
    catch { return null; }
  };
  const isGoogleUser = (user, token) => {
    const providers = (user?.providerData || []).map((item) => item?.providerId);
    const signInProvider = token?.signInProvider || token?.claims?.firebase?.sign_in_provider;
    return providers.includes('google.com') || signInProvider === 'google.com';
  };

  function clearDoseStorage({ includeE2E = false } = {}) {
    [safeStorage(localStorage), safeStorage(sessionStorage)].filter(Boolean).forEach((store) => {
      const keys = Array.from({ length: store.length }, (_, index) => store.key(index)).filter(Boolean);
      keys.forEach((key) => {
        const owned = OWN_KEYS.has(key) || key.startsWith('dosepranza_') || key.startsWith('dose_e2e_');
        if (owned && (includeE2E || key !== 'dose_e2e')) store.removeItem(key);
      });
    });
  }

  function purgeLegacyPreviewState() {
    const store = safeStorage(localStorage);
    if (!store) return false;
    ['dose_preview_admin', 'dose_preview_mode', 'dose_preview_pagnottella_orders'].forEach((key) => store.removeItem(key));
    try {
      const cached = JSON.parse(store.getItem('dose_user') || 'null');
      const simulated = String(cached?.provider || '').startsWith('github-pages-')
        || ['github-pages-admin-preview', 'pagnottella-review-preview'].includes(String(cached?.uid || ''))
        || normalize(cached?.email) === 'review.pagnottella@dosepranza.local';
      if (simulated) store.removeItem('dose_user');
      return simulated;
    } catch {
      store.removeItem('dose_user');
      return true;
    }
  }

  async function loadCore() {
    if (corePromise) return corePromise;
    corePromise = (async () => {
      try { await base.resolveSession(); } catch {}
      const [appSdk, authSdk] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js')
      ]);
      const app = appSdk.getApps().find((item) => item.name === '[DEFAULT]');
      if (!app) throw new Error('Firebase non inizializzato. Ricarica la pagina.');
      const auth = authSdk.getAuth(app);
      try { auth.useDeviceLanguage(); } catch {}
      try { await authSdk.setPersistence(auth, authSdk.browserLocalPersistence); }
      catch (error) { if (error?.code !== 'auth/unsupported-persistence') throw error; }
      if (typeof auth.authStateReady === 'function') await auth.authStateReady();
      else await new Promise((resolve) => {
        const unsubscribe = authSdk.onAuthStateChanged(auth, () => { unsubscribe(); resolve(); }, resolve);
      });
      return { auth, authSdk };
    })().catch((error) => { corePromise = null; throw error; });
    return corePromise;
  }

  async function invalidate(auth, authSdk) {
    try { await authSdk.signOut(auth); } catch {}
    try { localStorage.removeItem('dose_user'); } catch {}
  }

  async function resolveSession() {
    if (base.isTrustedLocalContext?.()) return base.getStoredUser?.() || null;
    const { auth, authSdk } = await loadCore();
    const user = auth.currentUser;
    if (!user) { localStorage.removeItem('dose_user'); return null; }
    if (user.isAnonymous || !user.uid || !user.email || user.emailVerified !== true) {
      await invalidate(auth, authSdk);
      return null;
    }
    let token;
    try { token = await user.getIdTokenResult(); } catch {}
    if (!isGoogleUser(user, token)) { await invalidate(auth, authSdk); return null; }
    const session = await base.resolveSession();
    if (!session?.uid || !session?.email || session.provider !== 'google.com'
      || session.uid !== user.uid || normalize(session.email) !== normalize(user.email)) {
      await invalidate(auth, authSdk);
      return null;
    }
    return session;
  }

  function setNext(value) {
    const next = ['russo', 'pagnottella'].includes(value) ? value : '';
    if (next) sessionStorage.setItem(NEXT_KEY, next); else sessionStorage.removeItem(NEXT_KEY);
    return next;
  }
  function takeNext() {
    const next = sessionStorage.getItem(NEXT_KEY) || '';
    sessionStorage.removeItem(NEXT_KEY);
    return ['russo', 'pagnottella'].includes(next) ? next : '';
  }

  async function completeRedirectSignIn() {
    if (base.isTrustedLocalContext?.()) {
      return { session: base.getStoredUser?.() || null, next: takeNext(), redirected: false };
    }
    const { auth, authSdk } = await loadCore();
    const result = await authSdk.getRedirectResult(auth);
    return { session: await resolveSession(), next: takeNext(), redirected: Boolean(result?.user) };
  }

  async function signInWithGoogle({ next = '' } = {}) {
    setNext(next);
    try {
      const raw = await base.signInWithGoogle();
      const session = await resolveSession();
      if (!session) {
        throw Object.assign(new Error('L’account deve essere verificato e autenticato tramite Google.'), { code: 'auth/invalid-session' });
      }
      takeNext();
      return { ...session, session, raw, redirected: false };
    } catch (error) {
      if (error?.code !== 'auth/popup-blocked') { takeNext(); throw error; }
      const { auth, authSdk } = await loadCore();
      const provider = new authSdk.GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      provider.setCustomParameters({ prompt: 'select_account' });
      await authSdk.signInWithRedirect(auth, provider);
      return { session: null, redirected: true };
    }
  }

  async function clearScopedRuntimeCaches() {
    const jobs = [];
    if (navigator.serviceWorker?.getRegistrations) {
      jobs.push(navigator.serviceWorker.getRegistrations().then((items) => Promise.allSettled(items
        .filter((item) => { try { return new URL(item.scope).pathname.startsWith(APP_PATH); } catch { return false; } })
        .map((item) => item.unregister()))));
    }
    if (window.caches?.keys) {
      jobs.push(window.caches.keys().then((keys) => Promise.allSettled(
        keys.filter((key) => /dose[-_]?pranza/i.test(key)).map((key) => window.caches.delete(key))
      )));
    }
    await Promise.allSettled(jobs);
  }

  async function prepareRelease() {
    if (!base.isTrustedLocalContext?.()) purgeLegacyPreviewState();
    const store = safeStorage(localStorage);
    const previous = store?.getItem(RELEASE_KEY) || '';
    if (previous === RELEASE) return { changed: false, previous, release: RELEASE };
    await clearScopedRuntimeCaches();
    store?.setItem(RELEASE_KEY, RELEASE);
    return { changed: true, previous, release: RELEASE };
  }

  async function signOutSession({ clearCaches = false, strict = false } = {}) {
    try { const { auth, authSdk } = await loadCore(); await authSdk.signOut(auth); }
    catch (error) { if (strict) throw error; }
    finally { clearDoseStorage(); if (clearCaches) await clearScopedRuntimeCaches(); }
    return true;
  }

  async function runtimeDiagnostics() {
    const report = {
      release: RELEASE,
      location: location.href,
      hostname: location.hostname,
      protocol: location.protocol,
      secureContext: window.isSecureContext,
      online: navigator.onLine,
      projectId: base.FIREBASE_PROJECT_ID || 'app-ordini-pranzo-alimentari',
      authDomain: base.FIREBASE_AUTH_DOMAIN || 'app-ordini-pranzo-alimentari.firebaseapp.com',
      cachedSession: base.getStoredUser?.() || null,
      firebaseSession: null,
      serviceWorkers: [],
      caches: [],
      error: null
    };
    try { report.firebaseSession = await resolveSession(); }
    catch (error) { report.error = `${error?.code || error?.name || 'Error'}: ${error?.message || error}`; }
    try { report.serviceWorkers = (await navigator.serviceWorker?.getRegistrations?.() || []).map((item) => item.scope); } catch {}
    try { report.caches = await window.caches?.keys?.() || []; } catch {}
    return report;
  }

  if (!base.isTrustedLocalContext?.()) purgeLegacyPreviewState();
  window.DoseSupplierAccess = Object.freeze({
    ...base,
    RELEASE,
    clearDoseStorage,
    purgeLegacyPreviewState,
    clearScopedRuntimeCaches,
    prepareRelease,
    resolveSession,
    completeRedirectSignIn,
    signInWithGoogle,
    signOutSession,
    runtimeDiagnostics
  });
})();
