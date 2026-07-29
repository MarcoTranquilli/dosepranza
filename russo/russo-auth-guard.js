(() => {
  const redirectToHub = () => window.location.replace('../?next=russo');
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
  verify();
})();
