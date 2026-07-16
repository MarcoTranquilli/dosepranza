(() => {
  const isPagesPreview = () => location.hostname === 'marcotranquilli.github.io' && localStorage.getItem('dose_preview_admin') === '1';
  const redirectToHub = () => window.location.replace('../?next=russo');
  const verify = async () => {
    const access = window.DoseSupplierAccess;
    if (!access || access.isFilePreview() || isPagesPreview()) return;
    if (access.isE2E()) return;
    try {
      const session = await access.resolveSession();
      if