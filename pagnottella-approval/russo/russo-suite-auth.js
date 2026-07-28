(() => {
  const redirectToSuite = () => {
    window.location.replace('../pagnottella-preview/?preview=admin&review=sponsor');
  };

  window.DoseRussoAuthReady = (async () => {
    const access = window.DoseSupplierAccess;
    if (!access) return null;
    try {
      const session = await access.resolveSession();
      if (!session || !await access.canAccessSupplier('russo', session)) {
        redirectToSuite();
        return null;
      }
      window.localStorage.setItem('dose_user', JSON.stringify(session));
      window.__DOSE_SUITE_SESSION__ = session;
      return session;
    } catch (error) {
      console.warn('Shared suite authentication unavailable.', error);
      redirectToSuite();
      return null;
    }
  })();
})();
