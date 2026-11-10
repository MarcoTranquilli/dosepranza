(function (root) {
  const day = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  function tracker() {
    let seen = null;
    return {
      reset() { seen = null; },
      observe(rows, selected, cached, pending = false) {
        if (cached || pending) return false;
        const next = new Set(rows.map(row => row.id));
        const added = seen !== null && selected === day() && rows.some(row => !seen.has(row.id) && row.day === selected);
        seen = next;
        return added;
      }
    };
  }
  function mount(supplier) {
    const key = `dose_supplier_audio_${supplier}`, watch = tracker();
    let enabled = false, context;
    try { enabled = localStorage.getItem(key) === 'true'; } catch {}
    const button = document.getElementById('supplier-audio-toggle');
    const test = document.getElementById('supplier-audio-test');
    function label() { if (button) { button.textContent = enabled ? '🔔 Audio attivo' : '🔕 Audio muto'; button.setAttribute('aria-pressed', String(enabled)); } }
    async function unlock() {
      const Audio = root.AudioContext || root.webkitAudioContext;
      if (!Audio) throw Error('Audio non supportato');
      context ||= new Audio();
      await context.resume();
    }
    function play() {
      if (!enabled || context?.state !== 'running') return;
      [587.33, 880].forEach((frequency, index) => {
        const oscillator = context.createOscillator(), gain = context.createGain(), start = context.currentTime + index * .2;
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(.0001, start);
        gain.gain.exponentialRampToValueAtTime(.12, start + .02);
        gain.gain.exponentialRampToValueAtTime(.0001, start + .4);
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.start(start); oscillator.stop(start + .42);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      });
    }
    async function gesture(toggle) {
      if (toggle) enabled = !enabled;
      try { if (enabled) { await unlock(); play(); } }
      catch { enabled = false; if (test) test.textContent = 'Audio non disponibile: riprova'; }
      try { localStorage.setItem(key, String(enabled)); } catch {}
      label();
    }
    button?.addEventListener('click', () => gesture(true));
    test?.addEventListener('click', () => { enabled = true; gesture(false); });
    document.addEventListener('pointerdown', () => { if (enabled) unlock().catch(() => {}); }, { once: true });
    label();
    return { reset: watch.reset, observe(rows, selected, cached, pending) { if (watch.observe(rows, selected, cached, pending)) play(); } };
  }
  root.DoseSupplierAudio = { tracker, mount, day };
})(typeof window === 'undefined' ? globalThis : window);
