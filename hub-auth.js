const access = window.DoseSupplierAccess;
const byId = (id) => document.getElementById(id);
let currentSession = null;
let currentSettings = null;
let redirecting = false;

function getNextTarget() {
  const target = new URLSearchParams(window.location.search).get('next') || '';
  return ['russo', 'pagnottella'].includes(target) ? target : '';
}

function resolveTargetHref(target) {
  if (target === 'pagnottella') return './pagnottella-preview/?preview=admin&store=pagnottella&v=auth-repair-1';
  return './russo/index.html?v=auth-repair-1';
}

function setAuthButtonsDisabled(disabled) {
  ['hub-google-login', 'hub-local-login'].forEach((id) => {
    const element = byId(id);
    if (element) element.disabled = !!disabled;
  });
}

function setAuthState(session, message = '') {
  const authenticated = !!session?.email;
  const isAdmin = !!session?.isAdmin;
  document.body.classList.remove('access-pending');
  document.body.classList.toggle('auth-locked', !authenticated);
  document.body.classList.toggle('auth-resolved', authenticated);
  document.body.classList.toggle('is-admin', isAdmin);
  document.body.classList.toggle('is-local-preview', access?.isFilePreview?.());
  const status = byId('hub-auth-status');
  if (!status) return;
  if (message) status.textContent = message;
  else if (authenticated) status.textContent = `Riconosciuto come ${session.name} · ${session.email}`;
  else if (access?.isFilePreview?.()) status.textContent = 'Accesso locale disponibile per la verifica offline.';
  else status.textContent = 'Nessuna sessione Google attiva.';
}

function redirectTo(target) {
  if (redirecting) return;
  redirecting = true;
  const status = byId('hub-auth-status');
  if (status) status.textContent = 'Accesso completato. Apertura del servizio...';
  window.location.replace(resolveTargetHref(target));
}

function scrollAdminPanelIntoView() {
  const panel = byId('supplier-control-panel') || byId('suppliers-grid');
  if (panel) window.setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
}

function renderSupplierSettings(settings) {
  currentSettings = settings;
  const enabled = settings?.pagnottella?.enabledForUsers === true;
  const toggle = byId('pagnottella-enabled');
  if (toggle) toggle.checked = enabled;
  if (byId('pagnottella-toggle-label')) byId('pagnottella-toggle-label').textContent = enabled ? 'Abilitata agli utenti' : 'Solo amministratore';
  if (byId('supplier-control-copy')) byId('supplier-control-copy').textContent = enabled ? 'La Pagnottella è raggiungibile dagli utenti tramite il suo collegamento diretto.' : 'La Pagnottella è raggiungibile solo dall’amministratore; gli utenti restano su Alimentari Russo.';
  if (byId('pagnottella-visibility-status')) byId('pagnottella-visibility-status').textContent = enabled ? 'Attiva per gli utenti' : 'Solo amministratore';
}

async function activateSession(session, honorNext = true) {
  currentSession = session;
  setAuthState(session);
  if (!session?.email) {
    setAuthState(null, 'Accesso non completato. Riprova con Google.');
    return;
  }
  if (!session.isAdmin) {
    redirectTo('russo');
    return;
  }
  let settings = access.DEFAULT_SETTINGS;
  let settingsWarning = '';
  try {
    settings = await access.getSupplierSettings();
  } catch (error) {
    console.warn('Supplier settings unavailable; admin defaults applied.', error);
    settingsWarning = ' Configurazione fornitori non disponibile: uso impostazioni sicure di default.';
  }
  renderSupplierSettings(settings);
  setAuthState(session, `Accesso amministratore completato. Puoi gestire i fornitori qui sotto.${settingsWarning}`);
  if (honorNext) {
    const next = getNextTarget();
    if (next) { redirectTo(next); return; }
  }
  scrollAdminPanelIntoView();
}

function technicalAuthDetails(error) {
  const code = error?.code || error?.name || '';
  const message = error?.message || '';
  const server = error?.customData?.serverResponse || error?.customData?._tokenResponse?.error?.message || '';
  const values = [code, message, server].filter(Boolean).join(' · ');
  return values || 'nessun dettaglio tecnico disponibile';
}

function friendlyAuthError(error) {
  console.error('Google auth failed', error);
  const code = error?.code || '';
  if (code === 'auth/popup-closed-by-user') return 'Accesso annullato: popup Google chiuso prima del completamento.';
  if (code === 'auth/cancelled-popup-request') return 'Accesso Google già in corso in un altro popup.';
  if (code === 'auth/popup-blocked') return 'Popup Google bloccato dal browser. Abilita i popup per questo sito e riprova.';
  if (code === 'auth/unauthorized-domain') return `Dominio non autorizzato su Firebase Auth: ${window.location.hostname}.`;
  if (code === 'auth/operation-not-supported-in-this-environment') return 'Il browser o il contesto corrente non supporta questo metodo di login Google.';
  return `Accesso Google non riuscito. Dettaglio tecnico: ${technicalAuthDetails(error)}`;
}

async function signInWithGoogleHub() {
  setAuthButtonsDisabled(true);
  setAuthState(null, 'Accesso Google in corso...');
  try {
    const session = await access.signInWithGoogle();
    await activateSession(session, true);
  } catch (error) {
    setAuthState(null, friendlyAuthError(error));
  } finally {
    setAuthButtonsDisabled(false);
  }
}

async function activateLocalPreviewAccess() {
  if (!access?.isFilePreview?.()) return;
  window.localStorage.setItem('dose_user', JSON.stringify({ uid: 'local-preview-admin', name: 'Marco Tranquilli', email: access.ADMIN_EMAIL, role: 'admin', isAdmin: true, provider: 'local-preview' }));
  const session = await access.resolveSession();
  await activateSession(session, true);
}

async function updatePagnottellaVisibility(event) {
  if (!currentSession?.isAdmin) return;
  const toggle = event.currentTarget;
  const requested = !!toggle.checked;
  const status = byId('supplier-control-status');
  toggle.disabled = true;
  if (status) status.textContent = 'Aggiornamento in corso...';
  try {
    const settings = await access.setSupplierEnabled('pagnottella', requested);
    renderSupplierSettings(settings);
    if (status) status.textContent = requested ? 'La Pagnottella è ora abilitata per gli utenti con link diretto.' : 'La Pagnottella è ora riservata all’amministratore.';
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
      if (currentSession?.isAdmin) return;
      event.preventDefault();
      setAuthState(currentSession, 'Questa scelta è riservata all’amministratore.');
    });
  });
}

async function init() {
  if (!access) throw new Error('Modulo di accesso fornitori non disponibile.');
  byId('hub-google-login')?.addEventListener('click', signInWithGoogleHub);
  byId('hub-local-login')?.addEventListener('click', activateLocalPreviewAccess);
  byId('pagnottella-enabled')?.addEventListener('change', updatePagnottellaVisibility);
  protectLinks();
  setAuthState(null);
  try {
    const session = await access.resolveSession();
    if (session) await activateSession(session, true);
  } catch (error) {
    setAuthState(null, `Impossibile verificare la sessione Google. Dettaglio tecnico: ${technicalAuthDetails(error)}`);
  }
}

init();
