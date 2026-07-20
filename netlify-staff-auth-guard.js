(() => {
  const STAFF = new Set([
    'marco.tranquilli@dos.design',
    'lorenzo.russo@alimentarirusso',
    'russolorenzo11@gmail.com',
    'beatrice.binini@dos.design',
    'monica.porta@dos.design'
  ]);

  const normalize = value => String(value || '').trim().toLowerCase();
  const readCachedUser = () => {
    try { return JSON.parse(localStorage.getItem('dose_user') || 'null'); }
    catch (_) { return null; }
  };
  const isStaffCache = () => STAFF.has(normalize(readCachedUser()?.email));

  async function loadAuthSdk() {
    return await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js');
  }

  async function clearStaleStaffSession(auth, authSdk) {
    if (!is