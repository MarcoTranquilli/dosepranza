(function (root) {
  'use strict';
  let lastPulse = -Infinity;

  function pulse() {
    try {
      if (root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return false;
      const navigator = root.navigator;
      if (typeof navigator?.vibrate !== 'function') return false;
      const now = Date.now();
      if (now - lastPulse < 100) return false;
      lastPulse = now;
      return navigator.vibrate(12) !== false;
    } catch (_) {
      return false;
    }
  }

  root.DoseCartFeedback = Object.freeze({ pulse });
})(typeof window === 'undefined' ? globalThis : window);
