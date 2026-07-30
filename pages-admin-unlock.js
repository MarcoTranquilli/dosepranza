(() => {
  const ADMIN_EMAIL = 'marco.tranquilli@dos.design';
  const SUPPLIER_EMAIL = 'commerciale@lapagnottellagourmet.it';
  const params = new URLSearchParams(location.search);
  const byId = (id) => document.getElementById(id);
  const isFilePreview = () => location.protocol === 'file:';
  const isPreviewHost = () => isFilePreview()
    || ['localhost', '127.0.0.1', '::1'].includes(location.hostname);
  const isE2E = () => !isFilePreview()
    && ['localhost', '127.0.0.1', '::1'].includes(location.hostname)
    && params.get('e2e') === '1';
  const localPreviewRequested = () => params.get('localPreview') === '1';
  const requestedRole = () => {
    const role = params.get('preview');
    return ['supplier', 'dos_user', 'external'].includes(role) ? role : 'admin';
  };

  function resetPreviewSessionIfRequested() {
    if (!params.has('swreset') && !params.has('authreset')) return;
    [
      'dose_preview_admin',
      'dose_user',
      'dose_supplier_settings',
      'dose_preview_pagnottella_orders',
      'dose_preview_mode'
    ].forEach((key) => localStorage.removeItem(key));
  }

  function consumeAuthResetOnce() {
    if (!params.has('swreset') && !params.has('authreset')) return;
    if (params.has('authreset')) sessionStorage.setItem('dose_firebase_auth_reset_pending', '1');
    resetPreviewSessionIfRequested();
    const cleanParams = new URLSearchParams(location.search);
    cleanParams.delete('swreset');
    cleanParams.delete('authreset');
    const query = cleanParams.toString();
    history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash || ''}`);
  }

  function storedGoogleSession() {
    try {
      const session = JSON.parse(localStorage.getItem('dose_user') || 'null');
      return session?.provider === 'google.com' && session?.email ? session : null;
    } catch (error) {
      return null;
    }
  }

  function previewSession() {
    const role = requestedRole();
    if (!isE2E()) {
      return {
        uid: 'local-pagnottella-dos-user',
        name: 'Utente DOS',
        email: 'utente.preview@dos.design',
        role: 'dos_user',
        isAdmin: false,
        supplierIds: ['russo', 'pagnottella'],
        provider: 'local-preview'
      };
    }
    if (role === 'supplier') {
      return {
        uid: 'local-pagnottella-supplier-preview',
        name: 'Commerciale Pagnottella Gourmet',
        email: SUPPLIER_EMAIL,
        role: 'supplier',
        isAdmin: false,
        supplierIds: ['pagnottella'],
        provider: 'local-preview'
      };
    }
    if (role === 'dos_user') {
      return {
        uid: 'local-pagnottella-dos-user',
        name: 'Utente DOS',
        email: 'utente.preview@dos.design',
        role: 'dos_user',
        isAdmin: false,
        supplierIds: ['russo', 'pagnottella'],
        provider: 'local-preview'
      };
    }
    if (role === 'external') {
      return {
        uid: 'local-pagnottella-external-user',
        name: 'Utente Esterno',
        email: 'test@gmail.com',
        role: 'user',
        isAdmin: false,
        supplierIds: [],
        provider: 'local-preview'
      };
    }
    return {
      uid: 'local-pagnottella-admin-preview',
      name: 'Marco Tranquilli',
      email: ADMIN_EMAIL,
      role: 'admin',
      isAdmin: true,
      supplierIds: [],
      provider: 'local-preview'
    };
  }

  function previewSettings() {
    return {
      russo: { enabledForUsers: true },
      pagnottella: { enabledForUsers: false }
    };
  }

  function storePreviewSession() {
    const googleSession = storedGoogleSession();
    if (googleSession) return googleSession;
    const session = previewSession();
    localStorage.setItem('dose_preview_admin', '1');
    localStorage.setItem('dose_preview_mode', session.role === 'supplier' ? 'supplier-review' : 'admin-review');
    localStorage.setItem('dose_user', JSON.stringify(session));
    if (!localStorage.getItem('dose_supplier_settings')) {
      localStorage.setItem('dose_supplier_settings', JSON.stringify(previewSettings()));
    }
    return session;
  }

  function localPreviewOrder(payload, session) {
    const id = payload?.clientOrderId || `pg-preview-${Date.now()}`;
    const order = {
      ...payload,
      id,
      uid: session.uid,
      user: session.name,
      email: session.email,
      createdAt: new Date().toISOString(),
      preview: true
    };
    let orders = [];
    try {
      orders = JSON.parse(localStorage.getItem('dose_preview_pagnottella_orders') || '[]');
    } catch (error) {
      orders = [];
    }
    orders.unshift(order);
    localStorage.setItem('dose_preview_pagnottella_orders', JSON.stringify(orders.slice(0, 50)));
    return { id, order, local: true };
  }

  function patchSupplierAccess(session) {
    if (!window.DoseSupplierAccess || session.provider === 'google.com') return;
    const base = window.DoseSupplierAccess;
    window.DoseSupplierAccess = Object.freeze({
      ...base,
      isFilePreview: () => isFilePreview(),
      isE2E: () => false,
      isTrustedLocalContext: () => true,
      getStoredUser: () => session,
      resolveSession: async () => session,
      signOut: async () => {
        localStorage.removeItem('dose_user');
        localStorage.removeItem('dose_preview_admin');
        localStorage.removeItem('dose_preview_mode');
      },
      getSupplierSettings: async () => JSON.parse(localStorage.getItem('dose_supplier_settings') || JSON.stringify(previewSettings())),
      setSupplierEnabled: async (supplierId, enabled) => {
        const next = JSON.parse(localStorage.getItem('dose_supplier_settings') || JSON.stringify(previewSettings()));
        next[supplierId] = { enabledForUsers: !!enabled };
        localStorage.setItem('dose_supplier_settings', JSON.stringify(next));
        return next;
      },
      canAccessSupplier: async (supplierId) => session.isAdmin === true || session.supplierIds?.includes(supplierId),
      createPagnottellaOrder: async (payload) => localPreviewOrder(payload, session)
    });
  }

  function activateLocalPreview() {
    if (!isPreviewHost()) return null;
    const googleSession = storedGoogleSession();
    if (googleSession) return googleSession;
    const session = storePreviewSession();
    patchSupplierAccess(session);
    const status = byId('authGateStatus');
    if (status) status.textContent = `${session.email} · ${window.DoseSupplierAccess?.roleLabel?.(session.role) || session.role}`;
    return session;
  }

  const localButton = byId('authGateLocal');
  if (localButton) {
    localButton.hidden = !isPreviewHost();
    localButton.disabled = !isPreviewHost();
    localButton.setAttribute('aria-hidden', String(!isPreviewHost()));
  }

  consumeAuthResetOnce();
  if (localPreviewRequested() && !storedGoogleSession()) activateLocalPreview();

  window.DosePagesAdminUnlock = activateLocalPreview;
})();
