(() => {
  const base = window.DoseSupplierAccess;
  if (!base || window.__DOSE_GOOGLE_DIRECT__) return;
  window.__DOSE_GOOGLE_DIRECT__ = true;

  const ADMIN_EMAIL = 'marco.tranquilli@dos.design';
  const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
  const originalResolve = base.resolveSession.bind(base);

  function providerEmail(user) {
    return (user?.providerData || []).map(item => item?.email).find(Boolean) || '';
  }

  function sessionFrom