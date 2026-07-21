const statusEl = document.getElementById('status');
const loginBtn = document.getElementById('login-btn');

function setStatus(text) {
  statusEl.textContent = text;
}

loginBtn.addEventListener('click', () => {
  if (!window.netlifyIdentity) return;
  window.netlifyIdentity.open();
});

if (window.netlifyIdentity) {
  window.netlifyIdentity.on('init', user => {
    if (user) {
      setStatus(`Ciao ${user.email}, reindirizzo ai report...`);
      setTimeout(() => { window.location.href = '/reports'; }, 600);
    } else {
      setStatus('Nessun utente autenticato.');
    }
  });
  window.netlifyIdentity.on('login', () => {
    setStatus('Accesso effettuato. Reindirizzo...');
    setTimeout(() => { window.location.href = '/reports'; }, 400);
  });
  window.netlifyIdentity.on('logout', () => {
    setStatus('Logout effettuato.');
  });
  window.netlifyIdentity.init();
}
