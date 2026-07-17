(() => {
  const params = new URLSearchParams(location.search);
  const isPages = location.hostname === 'marcotranquilli.github.io';
  const resetRequested = isPages && params.has('swreset');
  const previewRequested = isPages && params.get('preview') === 'admin' && !resetRequested;

  function removeAppStorage(storage) {
    if (!storage) return;
    const keys = [];
    for (let i = 0; i < storage