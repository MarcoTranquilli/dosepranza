(() => {
  const params = new URLSearchParams(location.search);
  const isPages = location.hostname === 'marcotranquilli.github.io';
  const resetRequested = isPages && params.has('swreset');
  const previewRequested = isPages && params.get('preview') === 'admin' && !resetRequested;

  function removeAppStorage(storage) {
    if (!storage) return;
    const keys = [];
    for (let i = 0; i < storage.length; i += 1) keys.push(storage.key(i));
    keys.forEach((key) => {
      if (!key) return;
      if (key.indexOf('dose_') === 0 || key.indexOf('firebase:') === 0 || key.indexOf('firebase') !== -1) storage.removeItem(key);
    });
  }

  function storedGoogleSession() {
    try {
      const raw = JSON.parse(localStorage.getItem('dose_user') || 'null');
      if (!raw?.email || !raw?.uid) return null;
      const provider = String(raw.provider || '').toLowerCase();
      if (provider !== 'google.com') return null;
      return raw;
    } catch (error) {
      return null;
    }
  }

  function deleteDb(name) {
    return new Promise((resolve) => {
      if (!window.indexedDB) { resolve(); return; }
      try {
        const request = window.indexedDB.deleteDatabase(name);
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
        request.onblocked = () => resolve();
      } catch (error) {
        resolve();
      }
    });
  }

  async function resetLocalSession() {
    removeAppStorage(window.localStorage);
    removeAppStorage(window.sessionStorage);
    const tasks = [deleteDb('firebaseLocalStorageDb'), deleteDb('firebase-heartbeat-database')];
    if (window.caches?.keys) tasks.push(window.caches.keys().then((keys) => Promise.all(keys.map((key) => window.caches.delete(key)))).catch(() => {}));
    if (navigator.serviceWorker?.getRegistrations) tasks.push(navigator.serviceWorker.getRegistrations().then((registrations) => Promise.all(registrations.map((registration) => registration.unregister()))).catch(() => {}));
    await Promise.allSettled(tasks);
  }

  if (resetRequested) {
    resetLocalSession().finally(() => window.location.replace('../?session=clean&v=' + Date.now()));
    return;
  }

  if (previewRequested) {
    localStorage.setItem('dose_preview_admin', '1');
    localStorage.setItem('dose_preview_mode', 'russo-review');
    localStorage.setItem('dose_user', JSON.stringify({
      uid: 'russo-review-preview',
      name: 'Anteprima interna',
      email: 'review.russo@dosepranza.local',
      role: 'review',
      isAdmin: true,
      provider: 'github-pages-russo-preview'
    }));
  }

  const isPagesPreview = () => isPages && previewRequested && localStorage.getItem('dose_preview_admin') === '1';
  const redirectToHub = () => window.location.replace('../?next=russo&v=auth-repair-2');
  const verify = async () => {
    const access = window.DoseSupplierAccess;
    if (!access || access.isFilePreview() || isPagesPreview()) return;
    if (access.isE2E()) return;
    if (storedGoogleSession()) return;
    try {
      const session = await access.resolveSession();
      if (!session) redirectToHub();
    } catch (error) {
      if (storedGoogleSession()) return;
      redirectToHub();
    }
  };
  verify();
})();