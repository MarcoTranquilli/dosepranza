(function initDoseFeedbackLogger(global) {
  'use strict';

  if (global.DoseFeedbackLogger) return;

  const MAX_ENTRIES = 30;
  const entries = [];
  const sensitiveKey = /(authorization|bearer|token|password|passwd|secret|api[_-]?key|credential)/gi;
  const jwt = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;

  function sanitize(value) {
    let text;
    try {
      text = typeof value === 'string' ? value : JSON.stringify(value);
    } catch (_) {
      text = String(value);
    }
    return String(text || '')
      .replace(jwt, '[REDACTED_JWT]')
      .replace(/((?:authorization|bearer|token|password|passwd|secret|api[_-]?key|credential)\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]')
      .replace(sensitiveKey, (match) => match.toLowerCase())
      .slice(0, 2000);
  }

  function capture(level, args) {
    entries.push({
      timestamp: new Date().toISOString(),
      level,
      message: Array.from(args || []).map(sanitize).join(' '),
    });
    if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
  }

  ['log', 'warn', 'error'].forEach((level) => {
    const original = console[level].bind(console);
    console[level] = function wrappedConsole(...args) {
      capture(level, args);
      original(...args);
    };
  });

  global.addEventListener('error', (event) => {
    capture('error', [`window.error: ${event.message || 'Errore non specificato'}`]);
  });
  global.addEventListener('unhandledrejection', (event) => {
    capture('error', [`unhandledrejection: ${sanitize(event.reason || 'Motivo non disponibile')}`]);
  });

  global.DoseFeedbackLogger = {
    getCapturedLogs() {
      return entries.map((entry) => ({ ...entry }));
    },
  };
})(window);
