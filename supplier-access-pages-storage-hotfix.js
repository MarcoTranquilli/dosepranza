(() => {
  const base = window.DoseSupplierAccess;
  if (!base || window.DoseSupplierAccessPagesStorageHotfix) return;
  window.DoseSupplierAccessPagesStorageHotfix = true;

  const ADMIN_EMAIL = 'marco.tranquilli@dos.design';
  const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

  function findStoredGoogleUser() {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index) || '';
      if (!key.startsWith('firebase:authUser:')) continue;
      try {
        const value = JSON.parse(window.localStorage.getItem(key) || 'null');
        const email = normalizeEmail(value?.email);
        if (!email) continue;
        const role = base.roleForEmail(email);
        const session = {
          uid: value?.uid || value?.localId || `stored-${Date.now()}`,
          name: value?.displayName || value?.providerData?.[0]?.displayName || email.split('@')[0],
          email,
          role,
          isAdmin: role === 'admin',
          supplierIds: base.supplierIdsForIdentity(email, role),
          provider: 'google.com'
        };
        window.localStorage.setItem('dose_user', JSON.stringify(session));
        return session;
      } catch (error) {
        continue;
      }
    }
    return null;
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  async function waitForStoredGoogleUser() {
    for (const ms of [0, 100, 250, 500, 800, 1200, 1600, 2200]) {
      if (ms) await delay(ms);
      const session = findStoredGoogleUser();
      if (session) return session;
    }
    return null;
  }

  window.DoseSupplierAccess = Object.freeze({
    ...base,
    async signInWithGoogle() {
      try {
        return await base.signInWithGoogle();
      } catch (error) {
        const session = await waitForStoredGoogleUser();
        if (session) return session;
        throw error;
      }
    },
    async resolveSession() {
      try {
        const session = await base.resolveSession();
        if (session) return session;
      } catch (error) {
        console.warn('Stored auth fallback after base resolve failure.', error);
      }
      return findStoredGoogleUser();
    }
  });
})();
