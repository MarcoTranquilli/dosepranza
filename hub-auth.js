const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCQJsNbgaR89gF_1vLe6H4DPboOhQvm9nI",
  authDomain: "app-ordini-pranzo-alimentari.firebaseapp.com",
  projectId: "app-ordini-pranzo-alimentari",
  storageBucket: "app-ordini-pranzo-alimentari.appspot.com",
  messagingSenderId: "553169964686",
  appId: "1:553169964686:web:7f8ca6f32a301949e4c3df"
};

let firebaseAuthPromise = null;
const byId = (id) => document.getElementById(id);
const isLocalPreview = () => location.protocol === 'file:';
const isGitHubPagesPreview = () => location.hostname.endsWith('github.io') || new URLSearchParams(location.search).get('preview') === '1';
const isPreviewAccess = () => isLocalPreview() || isGitHubPagesPreview();

function getStoredDoseUser() {
  try {
    return JSON.parse(localStorage.getItem('dose_user') || 'null');
  } catch (e) {
    return null;
  }
}

function getNextTarget() {
  try {
    return new URLSearchParams(location.search).get('next') || '';
  } catch (e) {
    return '';
  }
}

function resolveTargetHref(target) {
  if (target === 'russo') return './russo/';
  if (target === 'pagnottella') return './pagnottella/?store=pagnottella';
  return './';
}

function setAuthButtonsDisabled(disabled) {
  ['hub-google-login', 'hub-local-login'].forEach((id) => {
    const el = byId(id);
    if (el) el.disabled = !!disabled;
  });
}

function syncHubAuth(message = '') {
  const user = getStoredDoseUser();
  const locked = !(user?.email && user?.name);
  document.body.classList.toggle('auth-locked', locked);
  document.body.classList.toggle('auth-resolved', !locked);
  document.body.classList.toggle('is-local-preview', isPreviewAccess());

  const previewButton = byId('hub-local-login');
  if (previewButton && isPreviewAccess()) previewButton.textContent = 'Usa accesso preview';

  const status = byId('hub-auth-status');
  if (!status) return;
  if (!locked) {
    status.textContent = `Riconosciuto come ${user.name} · ${user.email}`;
  } else if (message) {
    status.textContent = message;
  } else if (isPreviewAccess()) {
    status.textContent = 'Accesso preview disponibile per testare come utente finale senza usare Netlify.';
  } else {
    status.textContent = 'Nessuna sessione Google attiva.';
  }
}

async function loadFirebaseAuth() {
  if (firebaseAuthPromise) return firebaseAuthPromise;
  firebaseAuthPromise = (async () => {
    const [{ initializeApp }, { getAuth, GoogleAuthProvider, signInWithPopup, browserLocalPersistence, setPersistence }] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js")
    ]);
    const app = initializeApp(FIREBASE_CONFIG, 'dosepranza-hub');
    const auth = getAuth(app);
    await setPersistence(auth, browserLocalPersistence);
    return { auth, GoogleAuthProvider, signInWithPopup };
  })();
  return firebaseAuthPromise;
}

async function signInWithGoogleHub() {
  if (isLocalPreview()) {
    syncHubAuth('Accesso preview disponibile per la verifica offline del catalogo.');
    return;
  }
  setAuthButtonsDisabled(true);
  syncHubAuth('Accesso Google in corso...');
  try {
    const { auth, GoogleAuthProvider, signInWithPopup } = await loadFirebaseAuth();
    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    const user = result?.user;
    const payload = {
      name: user?.displayName || user?.email?.split('@')[0] || 'Utente DOS',
      email: user?.email || ''
    };
    if (!payload.email) {
      syncHubAuth('Login Google completato ma email non disponibile.');
      return;
    }
    localStorage.setItem('dose_user', JSON.stringify(payload));
    syncHubAuth();
    const next = getNextTarget();
    if (next) location.href = resolveTargetHref(next);
  } catch (err) {
    const code = err?.code || '';
    if (code === 'auth/popup-closed-by-user') syncHubAuth('Accesso annullato: popup Google chiuso prima del completamento.');
    else if (code === 'auth/cancelled-popup-request') syncHubAuth('Accesso Google già in corso in un altro popup.');
    else if (code === 'auth/unauthorized-domain' && isGitHubPagesPreview()) syncHubAuth('Dominio GitHub Pages non autorizzato su Firebase: usa Accesso preview per testare senza Netlify.');
    else if (code === 'auth/unauthorized-domain') syncHubAuth(`Dominio non autorizzato su Firebase Auth: ${location.hostname}.`);
    else syncHubAuth(`Accesso Google non riuscito${code ? ` (${code})` : ''}. Riprova.`);
  } finally {
    setAuthButtonsDisabled(false);
  }
}

function activateLocalPreviewAccess() {
  if (!isPreviewAccess()) return;
  localStorage.setItem('dose_preview', '1');
  localStorage.setItem('dose_user', JSON.stringify({
    name: 'Utente Preview Sponsor',
    email: 'preview.sponsor@dosepranza.test',
    source: isGitHubPagesPreview() ? 'github-pages-preview' : 'local-access'
  }));
  syncHubAuth();
  const next = getNextTarget();
  if (next) location.href = resolveTargetHref(next);
}

function protectLinks() {
  document.querySelectorAll('.protected-link').forEach((link) => {
    link.addEventListener('click', (event) => {
      const user = getStoredDoseUser();
      if (user?.email && user?.name) return;
      event.preventDefault();
      const target = link.dataset.target || '';
      const message = target
        ? `Accedi con Google o usa Accesso preview per aprire ${target === 'russo' ? 'Alimentari Russo' : 'La Pagnottella Gourmet'}.`
        : 'Accedi con Google o usa Accesso preview per continuare.';
      syncHubAuth(message);
    });
  });
}

function init() {
  byId('hub-google-login')?.addEventListener('click', signInWithGoogleHub);
  byId('hub-local-login')?.addEventListener('click', activateLocalPreviewAccess);
  protectLinks();
  syncHubAuth();
  const user = getStoredDoseUser();
  const next = getNextTarget();
  if (user?.email && user?.name && next) {
    location.replace(resolveTargetHref(next));
  }
}

init();
