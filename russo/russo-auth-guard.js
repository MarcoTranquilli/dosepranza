(() => {
  const params = new URLSearchParams(location.search);
  if (location.hostname === 'marcotranquilli.github.io' && params.get('preview') === 'admin') {
    localStorage.setItem('dose_preview_admin', '1');
    localStorage.setItem('dose_user', JSON.stringify({
      uid: 'github-pages-admin-preview',
      name: 'Marco Tranquilli',
      email: 'marco.tranquilli@dos.design',
      role: 'admin',
      isAdmin: true,
      provider: 'github-pages-preview'
    }));
  }
  const isPagesPreview = () => location.hostname === 'marcotranquilli.github.io' && localStorage.getItem('dose_preview_admin') === '1';
  const redirectToHub = () => window.location.replace('../?next=russo');
  const verify = async () => {
    const access = window.DoseSupplierAccess;
    if (!access || access.isFilePreview() || isPagesPreview()) return;
    if (access.isE2E()) return;
    try {
      const session = await access.resolveSession();
      if (!session) redirectToHub();
    } catch (error) {
      redirectToHub();
    }
  };
  verify();
})();
