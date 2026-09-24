(function initDoseFeedbackWidget(global) {
  'use strict';

  if (global.DoseFeedbackWidget) return;

  const PROD_ENDPOINT = 'https://app-dosepranza.netlify.app/.netlify/functions/create-ticket';
  const state = { screenshot: '', status: 'idle' };

  function endpoint() {
    if (
      global.location.hostname === 'localhost' ||
      global.location.hostname === '127.0.0.1' ||
      global.location.hostname.endsWith('.netlify.app')
    ) {
      return '/.netlify/functions/create-ticket';
    }
    return PROD_ENDPOINT;
  }

  function knownEmail() {
    try {
      const raw = localStorage.getItem('dose_user');
      const email = raw ? JSON.parse(raw)?.email : '';
      return typeof email === 'string' ? email.trim().toLowerCase().slice(0, 254) : '';
    } catch (_) {
      return '';
    }
  }

  function markup() {
    return `
      <div class="dose-feedback-root">
        <button class="dose-feedback-fab" type="button" aria-haspopup="dialog">Feedback</button>
        <div class="dose-feedback-backdrop" hidden>
          <section class="dose-feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="dose-feedback-title">
            <header class="dose-feedback-head"><div><p class="dose-feedback-kicker">Assistenza DOSepranza</p><h2 class="dose-feedback-title" id="dose-feedback-title">Segnala un problema</h2></div><button class="dose-feedback-close" type="button" aria-label="Chiudi">×</button></header>
            <form class="dose-feedback-form">
              <div class="dose-feedback-grid">
                <label class="dose-feedback-field">Tipo<select name="requestType" required><option value="bug">Problema</option><option value="feature">Suggerimento</option><option value="support">Richiesta di assistenza</option></select></label>
                <label class="dose-feedback-field">Area<select name="component" required><option value="accesso">Accesso</option><option value="russo">Alimentari Russo</option><option value="pagnottella">Pagnottella Gourmet</option><option value="ordine">Ordine e pagamento</option><option value="altro">Altro</option></select></label>
              </div>
              <label class="dose-feedback-field">Titolo<input name="summary" maxlength="140" required placeholder="Descrivi il problema in breve"></label>
              <label class="dose-feedback-field">Dettagli<textarea name="description" maxlength="4000" required placeholder="Cosa stavi facendo e cosa è successo?"></textarea></label>
              <label class="dose-feedback-field">Email per essere ricontattato (facoltativa)<input name="userEmail" type="email" maxlength="254" autocomplete="email"></label>
              <div class="dose-feedback-options">
                <label class="dose-feedback-check"><input name="includeScreenshot" type="checkbox" checked>Allega screenshot della pagina</label>
                <label class="dose-feedback-check"><input name="includeDiagnostics" type="checkbox" checked>Allega diagnostica tecnica e ultimi log</label>
                <p class="dose-feedback-note">Controlla che nella schermata non siano presenti informazioni riservate. Token e credenziali vengono esclusi automaticamente.</p>
              </div>
              <p class="dose-feedback-status" role="status" aria-live="polite"></p>
              <button class="dose-feedback-submit" type="submit">Invia segnalazione</button>
            </form>
          </section>
        </div>
      </div>`;
  }

  async function capturePage(root) {
    state.screenshot = '';
    if (!global.html2canvas) return;
    try {
      root.style.display = 'none';
      const canvas = await global.html2canvas(document.body, {
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        allowTaint: false,
        scale: Math.min(global.devicePixelRatio || 1, 1.25),
      });
      state.screenshot = canvas.toDataURL('image/jpeg', 0.7);
      if (state.screenshot.length > 3_500_000) state.screenshot = canvas.toDataURL('image/jpeg', 0.45);
    } catch (error) {
      console.warn('Feedback screenshot unavailable', error?.message || 'capture-failed');
    } finally {
      root.style.display = '';
    }
  }

  function setStatus(node, message, kind) {
    node.textContent = message;
    node.dataset.kind = kind || '';
  }

  function mount() {
    if (document.querySelector('.dose-feedback-root')) return;
    const holder = document.createElement('div');
    holder.innerHTML = markup();
    const root = holder.firstElementChild;
    document.body.appendChild(root);

    const fab = root.querySelector('.dose-feedback-fab');
    const backdrop = root.querySelector('.dose-feedback-backdrop');
    const dialog = root.querySelector('.dose-feedback-dialog');
    const close = root.querySelector('.dose-feedback-close');
    const form = root.querySelector('form');
    const submit = root.querySelector('.dose-feedback-submit');
    const status = root.querySelector('.dose-feedback-status');
    form.elements.userEmail.value = knownEmail();

    const closeDialog = () => {
      backdrop.hidden = true;
      fab.focus();
    };

    fab.addEventListener('click', async () => {
      fab.disabled = true;
      await capturePage(root);
      backdrop.hidden = false;
      fab.disabled = false;
      form.elements.summary.focus();
      if (!navigator.onLine) setStatus(status, 'Sei offline. Riconnettiti prima di inviare.', 'error');
    });
    close.addEventListener('click', closeDialog);
    backdrop.addEventListener('click', (event) => { if (event.target === backdrop) closeDialog(); });
    dialog.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeDialog(); });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (state.status === 'submitting') return;
      if (!navigator.onLine) {
        setStatus(status, 'Connessione assente: la segnalazione non è stata inviata.', 'error');
        return;
      }
      state.status = 'submitting';
      submit.disabled = true;
      submit.textContent = 'Invio in corso…';
      setStatus(status, 'Invio della segnalazione in corso.', '');
      try {
        const includeDiagnostics = form.elements.includeDiagnostics.checked;
        const diagnostics = includeDiagnostics && global.DoseDiagnostics
          ? await global.DoseDiagnostics.getSystemDiagnostics() : null;
        const logs = includeDiagnostics && global.DoseFeedbackLogger
          ? global.DoseFeedbackLogger.getCapturedLogs() : [];
        const payload = {
          requestType: form.elements.requestType.value,
          component: form.elements.component.value,
          summary: form.elements.summary.value.trim(),
          description: form.elements.description.value.trim(),
          userEmail: form.elements.userEmail.value.trim(),
          screenshot: form.elements.includeScreenshot.checked ? state.screenshot : '',
          diagnostics,
          logs,
        };
        const response = await fetch(endpoint(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) throw new Error(result.error || `HTTP ${response.status}`);
        state.status = 'success';
        setStatus(status, `Segnalazione ${result.issueKey} creata correttamente.`, 'success');
        submit.textContent = 'Segnalazione inviata';
        form.elements.summary.value = '';
        form.elements.description.value = '';
      } catch (error) {
        state.status = 'error';
        setStatus(status, `Invio non riuscito: ${error.message || 'riprova più tardi'}.`, 'error');
        submit.disabled = false;
        submit.textContent = 'Riprova';
        return;
      }
      submit.disabled = false;
    });
  }

  global.DoseFeedbackWidget = { mount };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})(window);
