(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then((regs) => {
        if (!regs || regs.length === 0) return false;
        return Promise.all(regs.map((r) => r.unregister())).then(() => true);
      })
      .then(() => {
        if ('caches' in window) {
          return caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
        }
      })
      .catch(() => {});
  }

  if (location.hostname !== 'marcotranquilli.github.io') return;

  async function getPagesAuth() {
    if (window.auth_fb) return window.auth_fb;
    const appSdk = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js');
    const authSdk = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js');
    const cfg = {
      apiKey: 'AIzaSyCQJsNbgaR89gF_1vLe6H4DPboOhQvm9nI',
      authDomain: 'app-ordini-pranzo-alimentari.firebaseapp.com',
      projectId: 'app-ordini-pranzo-alimentari',
      storageBucket: 'app-ordini-pranzo-alimentari.appspot.com',
      messagingSenderId: '553169964686',
      appId: '1:553169964686:web:7f8ca6f32a301949e4c3df'
    };
    const app = appSdk.getApps().find(a => a.name === '[DEFAULT]') || appSdk.initializeApp(cfg);
    const auth = authSdk.getAuth(app);
    await authSdk.setPersistence(auth, authSdk.browserLocalPersistence).catch(() => {});
    window.auth_fb = auth;
    return auth;
  }

  document.addEventListener('click', async (event) => {
    const target = event.target && event.target.closest('[data-action="signin-google"],#role-google-login,#hub-google-login');
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      const authSdk = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js');
      const auth = await getPagesAuth();
      const provider = new authSdk.GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      provider.setCustomParameters({ prompt: 'select_account' });
      if (auth.currentUser && auth.currentUser.isAnonymous) {
        await authSdk.signOut(auth).catch(() => {});
      }
      await authSdk.signInWithRedirect(auth, provider);
    } catch (error) {
      console.warn('GitHub Pages Google redirect failed', error);
      const status = document.getElementById('hub-auth-status');
      if (status) status.textContent = 'Accesso non avviato: controlla la console.';
    }
  }, true);
})();