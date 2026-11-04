(() => {
  if (window.DoseGoogleLoginUI) return;
  const handlers = new Map();
  const bound = new WeakSet();
  let pending = false;
  function status(button, message) {
    const id = button.dataset.loginStatus;
    let output = id && document.getElementById(id);
    if (!output) {
      output = button.parentElement?.querySelector('[data-login-feedback]');
      if (!output && button.parentElement) {
        output = document.createElement('p');
        output.dataset.loginFeedback = '1';
        output.setAttribute('role', 'status');
        output.setAttribute('aria-live', 'polite');
        button.parentElement.appendChild(output);
      }
    }
    if (output) output.textContent = message;
  }
  function message(error) {
    if (error?.code === 'auth/popup-blocked') return 'Popup Google bloccato. Consenti i popup per questo sito oppure apri il link direttamente in Safari/Chrome.';
    if (error?.code === 'auth/popup-closed-by-user') return 'Accesso annullato. Puoi riprovare.';
    return 'Accesso Google non riuscito' + (error?.code ? ' (' + error.code + ')' : '') + '. Riprova o apri il link in Safari/Chrome.';
  }
  async function click(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const button = event.currentTarget;
    if (pending) return;
    pending = true;
    button.disabled = true;
    status(button, 'Accesso Google in corso. Se usi Slack, Teams, Mail o WhatsApp, apri il link direttamente in Safari/Chrome.');
    try {
      const handler = handlers.get(button.dataset.loginContext || 'default');
      if (!handler) throw new Error('login-not-ready');
      await handler();
    } catch (error) {
      status(button, message(error));
    } finally {
      pending = false;
      button.disabled = false;
    }
  }
  function bind() {
    document.querySelectorAll('[data-action="login-google"], #login-btn').forEach(button => {
      if (bound.has(button)) return;
      bound.add(button);
      button.removeAttribute('onclick');
      button.addEventListener('click', click, true);
    });
  }
  window.DoseGoogleLoginUI = { bind, register(context, handler) { handlers.set(context, handler); bind(); }, message };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
