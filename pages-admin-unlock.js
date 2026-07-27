(() => {
  const ADMIN_EMAIL = 'marco.tranquilli@dos.design';
  const SUPPLIER_EMAIL = 'commerciale@lapagnottellagourmet.it';
  const params = new URLSearchParams(location.search);
  const isPagnottellaReview = () => location.pathname.includes('/pagnottella-preview/') || params.get('review') === 'sponsor';
  const isPages = () => location.hostname === 'marcotranquilli.github.io'
    || (
      ['localhost', '127.0.0.1', '::1'].includes(location.hostname)
      && isPagnottellaReview()
      && params.get('review') === 'sponsor'
    );
  const requestedRole = () => params.get('preview') === 'supplier' ? 'supplier' : 'admin';
  const requested = () => ['admin', 'supplier'].includes(params.get('preview')) || localStorage.getItem('dose_preview_admin') === '1';
  const byId = (id) => document.getElementById(id);

  function resetPreviewSessionIfRequested() {
    if (!params.has('swreset')) return false;
    [
      'dose_preview_admin',
      'dose_user',
      'dose_supplier_settings',
      'dose_preview_pagnottella_orders',
      'dose_preview_mode'
    ].forEach((key) => localStorage.removeItem(key));
    return true;
  }

  function previewSession() {
    if (requestedRole() === 'supplier') {
      return {
        uid: 'github-pages-pagnottella-supplier-preview',
        name: 'Commerciale Pagnottella Gourmet',
        email: SUPPLIER_EMAIL,
        role: 'supplier',
        isAdmin: false,
        supplierIds: ['pagnottella'],
        provider: 'github-pages-pagnottella-supplier-preview'
      };
    }
    return {
      uid: 'github-pages-admin-preview',
      name: 'Marco Tranquilli',
      email: ADMIN_EMAIL,
      role: 'admin',
      isAdmin: true,
      provider: isPagnottellaReview() ? 'github-pages-pagnottella-admin-preview' : 'github-pages-admin-unlock'
    };
  }

  function previewSettings() {
    return {
      russo: { enabledForUsers: true },
      pagnottella: { enabledForUsers: false }
    };
  }

  function storePreviewSession() {
    const session = previewSession();
    localStorage.setItem('dose_preview_admin', '1');
    localStorage.setItem('dose_preview_mode', session.role === 'supplier' ? 'supplier-review' : (isPagnottellaReview() ? 'sponsor-review' : 'admin'));
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

  function patchSupplierAccess() {
    if (!isPages() || !requested() || !window.DoseSupplierAccess) return;
    const base = window.DoseSupplierAccess;
    const session = storePreviewSession();
    window.DoseSupplierAccess = Object.freeze({
      ...base,
      isFilePreview: () => true,
      isE2E: () => true,
      isTrustedLocalContext: () => true,
      getStoredUser: () => session,
      resolveSession: async () => session,
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

  function setSupplierDefaults() {
    const settings = JSON.parse(localStorage.getItem('dose_supplier_settings') || JSON.stringify(previewSettings()));
    const enabled = settings?.pagnottella?.enabledForUsers === true;
    const toggle = byId('pagnottella-enabled');
    if (toggle) toggle.checked = enabled;
    const label = byId('pagnottella-toggle-label');
    if (label) label.textContent = enabled ? 'Abilitata agli utenti' : 'Solo amministratore';
    const copy = byId('supplier-control-copy');
    if (copy) copy.textContent = 'Preview GitHub Pages attiva: puoi verificare i fornitori senza Google Login.';
    const status = byId('pagnottella-visibility-status');
    if (status) status.textContent = enabled ? 'Attiva per gli utenti' : 'Solo amministratore';
  }

  function unlockAdmin() {
    if (!isPages()) return;
    const session = storePreviewSession();
    patchSupplierAccess();
    document.body.classList.remove('access-pending', 'auth-locked');
    document.body.classList.add('auth-resolved');
    document.body.classList.toggle('is-admin', session.isAdmin === true);
    setSupplierDefaults();
    const status = byId('hub-auth-status');
    if (status) status.textContent = session.isAdmin
      ? 'Accesso amministratore GitHub Pages completato. Puoi gestire i fornitori qui sotto.'
      : 'Accesso Pagnottella completato. Puoi consultare il catalogo e gli ordini demo.';
    const panel = byId('supplier-control-panel') || byId('suppliers-grid');
    if (panel) setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
  }

  resetPreviewSessionIfRequested();
  patchSupplierAccess();
  if (isPages() && requested()) storePreviewSession();

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!target || target.id !== 'hub-local-login') return;
    if (!isPages()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    unlockAdmin();
  }, true);

  window.DosePagesAdminUnlock = unlockAdmin;
})();
