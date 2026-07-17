(() => {
  const $ = id => document.getElementById(id);
  const ADMIN = 'marco.tranquilli@dos.design';
  const status = $('hub-auth-status');
  const btn = $('hub-google-login');
  const admin = $('admin-actions');
  const set = msg => { if (status) status.textContent = msg; };
  const norm = v => String(v || '').trim().toLowerCase();
  const first = (...v) => v.find(x => String(x || '').trim());
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function session(user, result