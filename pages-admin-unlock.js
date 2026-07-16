(() => {
  const ADMIN_EMAIL = 'marco.tranquilli@dos.design';
  const isPages = () => location.hostname === 'marcotranquilli.github.io';
  const params = new URLSearchParams(location.search);
  const requested = () => params.get('preview') === 'admin' || localStorage.getItem('dose_preview_admin') === '1';
  const byId = (id) => document.getElementById(id);

  function adminSession() {
    return {
      uid: 'github-pages-admin-preview',
      name: 'Marco Tranquilli',
      email: ADMIN_EMAIL,
      role: 'admin',
      isAdmin: true,
      provider: 'github-pages-admin-unlock'
    };
  }

  function previewSettings() {
    return {
      russo: { enabledForUsers: true },
      pagnottella: { enabledForUsers: false }
    };
  }

  function storePreviewSession() {
    const session = adminSession();
    localStorage.setItem('dose_preview_admin', '1');
    localStorage.setItem('dose_user', JSON.stringify(session));
    if (!localStorage.getItem('dose_supplier_settings')) {
      localStorage.setItem('dose_supplier_settings', JSON.stringify(previewSettings()));
    }
    return session;
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
      canAccessSupplier: async () => true
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
    storePreviewSession();
    patchSupplierAccess();
    document.body.classList.remove('access-pending', 'auth-locked');
    document.body.classList.add('auth-resolved', 'is-admin');
    setSupplierDefaults();
    const status = byId('hub-auth-status');
    if (status) status.textContent = 'Accesso amministratore GitHub Pages completato. Puoi gestire i fornitori qui sotto.';
    const panel = byId('supplier-control-panel') || byId('suppliers-grid');
    if (panel) setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
  }

  patchSupplierAccess();
  if (requested()) storePreviewSession();

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
