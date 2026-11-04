const access = window.DoseSupplierAccess;
const byId = (id) => document.getElementById(id);

let currentSession = null;
let currentSettings = null;
let redirecting = false;
let loginPending = false;
let firebaseCore = null;
let authEpoch = 0;

const corporateSession = session => /^[^\s@]+@dos\.design$/i.test(String(session?.email || '').trim());
const adminSession = session => corporateSession(session) && session.isAdmin === true && session.email.trim().toLowerCase() === 'marco.tranquilli@dos.design';
const coordinatorSession = session => corporateSession(session) && session.role === 'coordinator';
const officeSession = session => adminSession(session) || coordinatorSession(session);
const webviewHint = () => /Slack|Teams|FBAN|FBAV|Instagram|WhatsApp|; wv\)|GSA\//i.test(window.navigator?.userAgent || '')
  ? 'Apri il link direttamente nel browser di sistema (Safari/Chrome) per completare il login con Google.'
  : '';


function getNextTarget() {
  const target = new URLSearchParams(window.location.search).get('next') || '';
  return ['russo', 'pagnottella', 'admin'].includes(target) ? target : '';
}

function resolveTargetHref(target) {
  if (target === 'pagnottella') return './pagnottella/?store=pagnottella';
  if (target === 'admin') return './admin/';
  return './russo/';
}

function setAuthButtonsDisabled(disabled) {
  ['hub-google-login', 'hub-local-login'].forEach((id) => {
    const element = byId(id);
    if (element) element.disabled = !!disabled;
  });
}

function setAuthState(session, message = '') {
  const authenticated = corporateSession(session);
  const isAdmin = adminSession(session);
  const canChooseSupplier = authenticated;
  if (byId('suppliers-grid')) byId('suppliers-grid').hidden = !canChooseSupplier;
  if (byId('coordinator-admin-link-wrapper')) byId('coordinator-admin-link-wrapper').hidden = !officeSession(session);
  if (byId('supplier-control-panel')) byId('supplier-control-panel').hidden = !isAdmin;
  byId('suppliers-grid')?.classList?.toggle('auth-locked', !authenticated);
  document.body.classList.toggle('auth-authenticated', authenticated);
  document.body.classList.toggle('role-admin', isAdmin);
  document.body.classList.toggle('role-coordinator', coordinatorSession(session));
  document.body.classList.toggle('role-user', authenticated && !officeSession(session));
  document.body.classList.remove('access-pending');
  document.body.classList.toggle('auth-locked', !authenticated);
  document.body.classList.toggle('auth-resolved', authenticated);
  document.body.classList.toggle('is-admin', isAdmin);
  document.body.classList.toggle('is-local-preview', access?.isFilePreview?.());

  const status = byId('hub-auth-status');
  if (!status) return;
  if (message) {
    status.textContent = message;
  } else if (authenticated) {
    status.textContent = `Riconosciuto come ${session.name} · ${session.email}`;
  } else if (access.isFilePreview()) {
    status.textContent = 'Accesso locale disponibile per la verifica offline.';
  } else {
    status.textContent = 'Nessuna sessione Google attiva.';
  }
}

function redirectTo(target) {
  if (redirecting) return;
  redirecting = true;
  const status = byId('hub-auth-status');
  if (status) status.textContent = 'Accesso completato. Apertura del servizio...';
  window.location.replace(resolveTargetHref(target));
}

function renderSupplierSettings(settings) {
  currentSettings = settings;
  const enabled = settings?.pagnottella?.enabledForUsers === true;
  const toggle = byId('pagnottella-enabled');
  if (toggle) toggle.checked = enabled;
  if (byId('pagnottella-toggle-label')) {
    byId('pagnottella-toggle-label').textContent = enabled ? 'Abilitata agli utenti' : 'Solo amministratore';
  }
  if (byId('supplier-control-copy')) {
    byId('supplier-control-copy').textContent = enabled
      ? 'La Pagnottella è raggiungibile dagli utenti tramite il suo collegamento diretto.'
      : 'La Pagnottella è raggiungibile solo dall’amministratore; gli utenti restano su Alimentari Russo.';
  }
  if (byId('pagnottella-visibility-status')) {
    byId('pagnottella-visibility-status').textContent = enabled ? 'Attiva per gli utenti' : 'Solo amministratore';
  }
}

async function activateSession(session, honorNext = true) {
  currentSession = session;
  setAuthState(session);

  if (!session?.email) {
    setAuthState(null, 'Accesso non completato. Riprova con Google.');
    return;
  }

  if (!corporateSession(session)) {
    setAuthState(session, 'Accedi con un account aziendale @dos.design per scegliere il fornitore.');
    return;
  }

  const next = honorNext ? getNextTarget() : '';
  if (next && (next !== 'admin' || officeSession(session))) {
    redirectTo(next);
    return;
  }
  setAuthState(session, 'Scegli il fornitore per ordinare.');
  if (!adminSession(session)) return;
  try {
    renderSupplierSettings(await access.getSupplierSettings());
  } catch {
    if (byId('supplier-control-status')) byId('supplier-control-status').textContent = 'Configurazione non disponibile. Riprova piu tardi.';
  }
}

function friendlyAuthError(error) {
  const code = error?.code || '';
  if (code === 'auth/popup-blocked') return 'Popup Google bloccato. Consenti i popup per questo sito e riprova. Se usi Slack, Mail o Teams, apri il link in Safari/Chrome.';
  if (code === 'auth/operation-not-supported-in-this-environment') return 'Apri il link direttamente nel browser di sistema (Safari/Chrome) per completare il login con Google.';
  if (code === 'auth/popup-closed-by-user') return 'Accesso annullato: popup Google chiuso prima del completamento.';
  if (code === 'auth/cancelled-popup-request') return 'Accesso Google già in corso in un altro popup.';
  if (code === 'auth/unauthorized-domain') return `Dominio non autorizzato su Firebase Auth: ${window.location.hostname}.`;
  return `Accesso Google non riuscito${code ? ` (${code})` : ''}. Riprova o ricarica la pagina.`;
}

async function signInWithGoogleHub() {
  if (loginPending) return;
  loginPending = true;
  authEpoch++;
  setAuthButtonsDisabled(true);
  setAuthState(null, webviewHint() || 'Accesso Google in corso...');
  try {
    if (!access?.ensureFirebase) throw new Error('Modulo di accesso non disponibile. Ricarica la pagina.');
    const { auth, authSdk } = firebaseCore || await access.ensureFirebase();
    const provider = new authSdk.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await authSdk.signInWithPopup(auth, provider);
    const session = await access.resolveSession();
    if (!session) throw new Error('Sessione Google non disponibile. Riprova.');
    await activateSession(session, true);
  } catch (error) {
    setAuthState(null, friendlyAuthError(error));
  } finally {
    loginPending = false;
    setAuthButtonsDisabled(false);
  }
}

async function activateLocalPreviewAccess() {
  if (!access.isFilePreview()) return;
  window.localStorage.setItem('dose_user', JSON.stringify({
    uid: 'local-preview-admin',
    name: 'Marco Tranquilli',
    email: access.ADMIN_EMAIL,
    role: 'admin',
    isAdmin: true,
    provider: 'local-preview'
  }));
  const session = await access.resolveSession();
  await activateSession(session, true);
}

async function updatePagnottellaVisibility(event) {
  if (!adminSession(currentSession)) return;
  const toggle = event.currentTarget;
  const requested = !!toggle.checked;
  const status = byId('supplier-control-status');
  toggle.disabled = true;
  if (status) status.textContent = 'Aggiornamento in corso...';
  try {
    const settings = await access.setSupplierEnabled('pagnottella', requested);
    renderSupplierSettings(settings);
    if (status) status.textContent = requested
      ? 'La Pagnottella è ora abilitata per gli utenti con link diretto.'
      : 'La Pagnottella è ora riservata all’amministratore.';
  } catch (error) {
    toggle.checked = currentSettings?.pagnottella?.enabledForUsers === true;
    if (status) status.textContent = error?.message || 'Impossibile aggiornare la configurazione.';
  } finally {
    toggle.disabled = false;
  }
}

function protectLinks() {
  document.querySelectorAll('.protected-link').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (corporateSession(currentSession)) return;
      event.preventDefault();
      setAuthState(currentSession, 'Accedi con Google usando il tuo account aziendale @dos.design per ordinare.');
    });
  });
}

async function init() {

  if (window.DoseGoogleLoginUI) window.DoseGoogleLoginUI.register('hub', signInWithGoogleHub);
  else byId('hub-google-login')?.addEventListener('click', signInWithGoogleHub);
  byId('hub-local-login')?.addEventListener('click', activateLocalPreviewAccess);
  byId('pagnottella-enabled')?.addEventListener('change', updatePagnottellaVisibility);
  protectLinks();
  setAuthState(null);
  const hint = byId('hub-browser-hint');
  if (hint) { hint.textContent = webviewHint() || 'Se il login non si apre da Slack, Teams, Mail o WhatsApp, apri questa pagina in Safari o Chrome.'; }
  const epoch = authEpoch;
  try {
    if (!access) throw new Error('auth-unavailable');
    if (access.ensureFirebase) firebaseCore = await access.ensureFirebase();
    const session = await access.resolveSession();
    if (epoch !== authEpoch) return;
    if (session) await activateSession(session, true);
  } catch (error) {
    if (epoch === authEpoch) setAuthState(null, 'Impossibile verificare la sessione Google. Riprova con il pulsante o ricarica la pagina.');
  }
}

init();
