(() => {
  const params = new URLSearchParams(location.search);
  const isPages = location.hostname === 'marcotranquilli.github.io';
  const resetRequested = isPages && params.has('swreset');
  const previewRequested = isPages && params.get('preview') === 'admin' && !resetRequested;

  const resetKeys = new Set([
    'dose_preview_admin',
    'dose_preview_mode',
    'dose_user',
    'dose