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

  document.addEventListener('click', async (event) => {
    const target = event.target && event.target.closest('[data-action="signin-google"],#role-google-login');
    if (!target || !window.auth_fb) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      const authSdk = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js');
      const provider = new authSdk.GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      provider.setCustomParameters({ prompt: 'select_account' });
      if (window.auth_fb.currentUser && window.auth_fb.currentUser.isAnonymous) {
        await authSdk.signOut(window.auth_fb).catch(() => {});
      }
      await authSdk.signInWithRedirect(window.auth_fb, provider);
    } catch (error) {
      console.warn('GitHub Pages Google redirect failed', error);
    }
  }, true);
})();
