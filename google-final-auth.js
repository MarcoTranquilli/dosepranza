(() => {
  const status = document.getElementById('hub-auth-status');
  const button = document.getElementById('hub-google-login');
  const admin = document.getElementById('admin-actions');
  const ADMIN_EMAIL = 'marco.tranquilli@dos.design';
  const setStatus = (message) => { if (status) status.textContent = message; };
  const norm = (value) => String(value || '').trim().toLowerCase();
  const first = (...values) => values.find(value => String(value || '').trim());

  function saveSession(user, result) {
   