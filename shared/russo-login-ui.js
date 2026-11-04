window.DoseGoogleLoginUI?.register('russo', async () => {
  if (typeof window.signInWithGoogle !== 'function') throw new Error('login-not-ready');
  await window.signInWithGoogle();
});
