(() => {
  const params = new URLSearchParams(location.search);
  const isSuiteEntry = params.get('suite') === 'production';
  const redirectToHub = () => window.location.replace('../?next=russo');
  const renderSuiteReturn = () => {
    const bar = document.getElementById('suite-return-bar');
    if (bar) bar.classList.toggle('hidden', !isSuiteEntry);
  };
  const verify = async () => {
    const access = window.DoseSupplierAccess;
    if (!access || access.isFilePreview()) return;
    if (access.isE2E()) return;
    try {
      const session = await access.resolveSession();
      if (!session || !(await access.canAccessSupplier('russo', session))) redirectToHub();
    } catch (error) {
      redirectToHub();
    }
  };
  const bootstrap = () => {
    renderSuiteReturn();
    verify();
  };
  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', bootstrap, { once:true })
    : bootstrap();
})();
