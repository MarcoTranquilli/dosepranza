(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.DosePranzaCutoff = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VENDOR_CUTOFFS = Object.freeze({
    russo: Object.freeze({hour: 10, minute: 30, countdownMinutes: 20, blocking: true, label: 'Alimentari Russo'}),
    pagnottella: Object.freeze({hour: 11, minute: 0, countdownMinutes: 20, blocking: false, label: 'Pagnottella Gourmet'})
  });
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  });

  function getRomeDateParts(epochMs = Date.now()) {
    const safeMs = Number.isFinite(epochMs) ? epochMs : Date.now();
    if (!Number.isFinite(new Date(safeMs).getTime())) throw new RangeError('Timestamp fuori intervallo');
    const parts = {};
    for (const part of formatter.formatToParts(new Date(safeMs))) {
      if (part.type !== 'literal') parts[part.type] = part.value;
    }
    return {
      year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
      hour: Number(parts.hour) % 24, minute: Number(parts.minute), second: Number(parts.second),
      isoDate: `${parts.year}-${parts.month}-${parts.day}`
    };
  }

  function computeClockOffsetMs(serverDateHeader, localNowMs = Date.now()) {
    if (typeof serverDateHeader !== 'string' || !Number.isFinite(localNowMs)) return 0;
    const serverMs = Date.parse(serverDateHeader.trim());
    return Number.isFinite(serverMs) ? serverMs - localNowMs : 0;
  }

  function formatCountdownMMSS(totalSeconds) {
    const seconds = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }

  function evaluateCutoff(vendorKey, options = {}) {
    if (!Object.prototype.hasOwnProperty.call(VENDOR_CUTOFFS, vendorKey)) {
      throw new Error(`Fornitore non supportato: ${vendorKey}`);
    }
    const config = VENDOR_CUTOFFS[vendorKey];
    const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
    const offset = Number.isFinite(options.clockOffsetMs) ? options.clockOffsetMs : 0;
    const rome = getRomeDateParts(nowMs + offset);
    const elapsed = rome.hour * 3600 + rome.minute * 60 + rome.second;
    const cutoff = config.hour * 3600 + config.minute * 60;
    const isPassed = elapsed >= cutoff;
    const remainingSeconds = Math.max(0, cutoff - elapsed);
    return {
      vendor: vendorKey, label: config.label, isoDate: rome.isoDate,
      prepStorageKey: `dosepranza_prep_${rome.isoDate}`,
      romeTime: [rome.hour, rome.minute, rome.second].map(value => String(value).padStart(2, '0')).join(':'),
      remainingSeconds, formattedRemaining: formatCountdownMMSS(remainingSeconds),
      isCountdownActive: !isPassed && elapsed >= cutoff - config.countdownMinutes * 60,
      isPassed, isBlocked: isPassed && config.blocking
    };
  }

  function triggerSafeHaptic(pattern = 15, win, nav) {
    try {
      if (win === undefined) win = globalThis.window;
      if (nav === undefined) nav = globalThis.navigator;
      if (!nav || typeof nav.vibrate !== 'function') return false;
      if (win && typeof win.matchMedia === 'function' && win.matchMedia('(prefers-reduced-motion: reduce)')?.matches) return false;
      return Boolean(nav.vibrate(pattern));
    } catch (_) {
      return false;
    }
  }

  return {VENDOR_CUTOFFS, getRomeDateParts, computeClockOffsetMs, formatCountdownMMSS, evaluateCutoff, triggerSafeHaptic};
});
