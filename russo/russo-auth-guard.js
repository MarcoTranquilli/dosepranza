(() => {
  try {
    if (window.location.protocol === 'file:') return;
    const params = new URLSearchParams(window.location.search);
    const isE2E = params.get('e2e') === '1' || localStorage.getItem('dose_e2e') === '1';
    const user = JSON.parse(localStorage.getItem('dose_user') || 'null');
    const hasUser = !!(user && user.email && user.name);
    if (!hasUser && !isE2E) {
      window.location.replace('../?next=russo');
    }
  } catch (e) {}
})();
