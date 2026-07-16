(() => {
  const ADMIN_EMAIL = 'marco.tranquilli@dos.design';
  const isPages = () => location.hostname === 'marcotranquilli.github.io';
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

  function setSupplierDefaults() {
    const enabled = false;
    const toggle = byId('pagnottella-enabled');
    if (toggle) toggle.checked = enabled;
    const label = byId('pagnottella-toggle-label');
    if (label) label.textContent = enabled ? 'Abilitata agli utenti' : 'Solo amministratore';
    const copy = byId('supplier-control-copy');
    if (copy) copy.textContent = 'La Pagnottella e visibile all amministratore. Usa il pannello per verificare il fornitore.';
    const status = byId('pagnottella-visibility-status');
    if (status) status.textContent = enabled ? 'Attiva per gli utenti' : 'Solo amministratore';
  }

  function unlockAdmin() {
    if (!isPages()) return;
    const session = adminSession();
    localStorage.setItem('dose_user', JSON.stringify(session));
    document.body.classList.remove('access-pending', 'auth-locked');
    document.body.classList.add('auth-resolved', 'is-admin');
    setSupplierDefaults();
    const status = byId('hub-auth-status');
    if (status) status.textContent = 'Accesso amministratore GitHub Pages completato. Puoi gestire i fornitori qui sotto.';
    const panel = byId('supplier-control-panel') || byId('suppliers-grid');
    if (panel) setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
  }

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
