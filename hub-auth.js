const access = window.DoseSupplierAccess;
const $ = (id) => document.getElementById(id);
const VERSION = 'auth-repair-3';
let currentSession = null;
let currentSettings = null;
let redirecting = false;

function nextTarget() {
  const value = new URLSearchParams(location.search).get('next') || '';
  return ['russo', 'pagnottella'].includes(value) ? value : '';
}

function targetHref(target) {
  if (target === 'pagnottella') return `./pagnottella-preview/?preview=admin&store=pagnottella&v=${VERSION}`;
  return `./russo/index.html?v=${VERSION}`;
}

function disableAuth(disabled) {
  ['hub-google-login', 'hub-local-login'].forEach((id) => { const el = $(id); if (el) el.disabled = !!disabled; });
}

function statusText(message) {
  const el = $('hub-auth-status');
  if (el) el.textContent = message;
}

function setAuthState(session, message = '') {
  const ok = !!session?.email;
  const admin = !!session?.isAdmin;
  document.body.classList.remove('access-pending');
  document.body.classList.toggle('auth-locked', !ok);
  document.body.classList.toggle('auth-resolved', ok);
  document.body.classList.toggle('is-admin', admin);
  document.body.classList.toggle('is-local-preview', false);
  if (message) statusText(message);
  else if (ok) statusText(`Riconosciuto come ${session.name} · ${session.email}`);
  else statusText('Nessuna sessione Google attiva.');
}

function redirectTo(target) {
  if (redirecting) return;
  redirecting = true;
  statusText('Accesso completato. Apertura del servizio...');
  location.replace(targetHref(target));
}

function renderSettings(settings) {
  currentSettings = settings;
  const enabled = settings?.pagnottella?.enabledForUsers === true;
  const toggle = $('pagnottella-enabled');
  if (toggle) toggle.checked = enabled;
  if ($('pagnottella-toggle-label')) $('pagnottella-toggle-label').textContent = enabled ? 'Abilitata agli utenti' : 'Solo amministratore';
  if ($('supplier-control-copy')) $('supplier-control-copy').textContent = enabled ? 'La Pagnottella è raggiungibile dagli utenti tramite il suo collegamento diretto.' : 'La Pagnottella è raggiungibile solo dall’amministratore; gli utenti restano su Alimentari Russo.';
  if ($('pagnottella-visibility-status')) $('pagnottella-visibility-status').textContent = enabled ? 'Attiva per gli utenti' : 'Solo amministratore';
}

async function activate(session, honorNext = true) {
  currentSession = session;
  setAuthState(session);
  if (!session?.email) { setAuthState(null, 'Accesso non completato. Riprova con Google.'); return; }
  if (!session.isAdmin) { redirectTo('russo'); return; }
  let settings = access.DEFAULT_SETTINGS;
  let warning = '';
  try { settings = await access.getSupplierSettings(); }
  catch (error) { console.warn('Supplier settings unavailable', error); warning = ' Configurazione fornitori non disponibile: uso impostazioni sicure di default.'; }
  renderSettings(settings);
  setAuthState(session, `Accesso amministratore completato. Puoi gestire i fornitori qui sotto.${warning}`);
  const target = honorNext ? nextTarget() : '';
  if (target) { redirectTo(target); return; }
  const panel = $('supplier-control-panel') || $('suppliers-grid');
  if (panel) setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
}

function details(error) {
  return [error?.code || error?.name || '', error?.message || '', error?.customData?.serverResponse || ''].filter(Boolean).join(' · ') || 'nessun dettaglio tecnico disponibile';
}

function friendly(error) {
  console.error('Google auth failed', error);
  const code = error?.code || '';
  if (code === 'auth/popup-closed-by-user') return 'Accesso annullato: popup Google chiuso prima del completamento.';
  if (code === 'auth/cancelled-popup-request') return 'Accesso Google già in corso in un altro popup.';
  if (code === 'auth/popup-blocked') return 'Popup Google bloccato dal browser. Abilita i popup per questo sito e riprova.';
  if (code === 'auth/unauthorized-domain') return `Dominio non autorizzato su Firebase Auth: ${location.hostname}.`;
  return `Accesso Google non riuscito. Dettaglio tecnico: ${details(error)}`;
}

async function googleLogin() {
  disableAuth(true);
  setAuthState(null, 'Accesso Google in corso...');
  try { await activate(await access.signInWithGoogle(), true); }
  catch (error) { setAuthState(null, friendly(error)); }
  finally { disableAuth(false); }
}

async function updatePagnottella(event) {
  if (!currentSession?.isAdmin) return;
  const toggle = event.currentTarget;
  const requested = !!toggle.checked;
  const status = $('supplier-control-status');
  toggle.disabled = true;
  if (status) status.textContent = 'Aggiornamento in corso...';
  try {
    const settings = await access.setSupplierEnabled('pagnottella', requested);
    renderSettings(settings);
    if (status) status.textContent = requested ? 'La Pagnottella è ora abilitata per gli utenti con link diretto.' : 'La Pagnottella è ora riservata all’amministratore.';
  } catch (error) {
    toggle.checked = currentSettings?.pagnottella?.enabledForUsers === true;
    if (status) status.textContent = error?.message || 'Impossibile aggiornare la configurazione.';
  } finally { toggle.disabled = false; }
