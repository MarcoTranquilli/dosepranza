(() => {
  const base = window.DoseSupplierAccess;
  if (!base || window.__DOSE_GOOGLE_REPAIR__) return;
  window.__DOSE_GOOGLE_REPAIR__ = true;

  const ADMIN_EMAIL = 'marco.tranquilli@dos.design';
  const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

  function storeFirebaseUser(firebaseUser) {
    if (!firebaseUser || firebaseUser.isAnonymous || !firebaseUser.email || !firebaseUser.uid) return null;
    const email = normalizeEmail(firebaseUser