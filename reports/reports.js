async function loadReports() {
  const listEl = document.getElementById('reports-list');
  const qEl = document.getElementById('filter-q');
  const fromEl = document.getElementById('filter-from');
  const toEl = document.getElementById('filter-to');
  const highEl = document.getElementById('filter-high');
  const autoEl = document.getElementById('auto-refresh');
  const autoWrap = document.getElementById('auto-wrap');

  let data = [];
  let timer = null;
  let isAdmin = false;

  async function fetchData() {
    try {
      const res = await fetch('/.netlify/functions/reports', { cache: 'no-store' });
      if (res.ok) data = await res.json();
      else data = [];
    } catch (e) {
      data = [];
    }
  }

  function render() {
    // KPIs
    const total = data.length;
    const passed = data.filter(d => d.summary && d.summary.status === 'pass').length;
    const passRate = total ? Math.round((passed / total) * 100) : 0;
    const last = data[0] ? new Date(data[0].date).toLocaleDateString('it-IT') : '-';
    const now = new Date();
    const last7 = data.filter(d => (now - new Date(d.date)) / (1000 * 60 * 60 * 24) <= 7).length;

    document.getElementById('kpi-total').textContent = total.toString();
    document.getElementById('kpi-pass').textContent = `${passRate}%`;
    document.getElementById('kpi-last').textContent = last;
    document.getElementById('kpi-7d').textContent = last7.toString();

    renderTrend();
    renderSeverityMap();
    renderFailureTrend();

    const q = (qEl.value || '').toLowerCase();
    const from = fromEl.value ? new Date(fromEl.value) : null;
    const to = toEl.value ? new Date(toEl.value) : null;
    const onlyHigh = !!highEl?.checked;

    const filtered = data.filter(r => {
      const d = new Date(r.date);
      if (from && d < from) return false;
      if (to && d > to) return false;
      if (q && !r.label.toLowerCase().includes(q)) return false;
      if (onlyHigh && (r.summary?.severityCounts?.high || 0) === 0) return false;
      return true;
    });

    listEl.innerHTML = filtered.length
      ? filtered.map(r => `
        <div class="item">
          <div>
            <div><strong>${r.label}</strong></div>
            <div class="badge">${new Date(r.date).toLocaleString('it-IT')} • ${r.summary?.status || 'pass'}</div>
          </div>
          <a href="/.netlify/functions/report?key=${encodeURIComponent(r.key)}">PDF</a>
        </div>
      `).join('')
      : '<div class="muted">Nessun report disponibile.</div>';

    // Fail reasons
    const failPanel = document.getElementById('fail-panel');
    const failList = document.getElementById('fail-list');
    const failures = (filtered[0]?.summary?.failures || []).slice(0, 5);
    if (failures.length) {
      failPanel.style.display = 'block';
      failList.innerHTML = failures.map(f => `
        <div class="item">
          <div>
            <div><strong>${f.title}</strong></div>
            <div class="badge">${f.file || ''} • ${f.severity || 'high'}</div>
          </div>
          <div class="muted">${f.error}</div>
        </div>
      `).join('');
    } else {
      failPanel.style.display = 'none';
      failList.innerHTML = '';
    }

    // Fail details with stacktrace
    const detailPanel = document.getElementById('fail-detail-panel');
    const detailBox = document.getElementById('fail-detail');
    if (failures.length) {
      detailPanel.style.display = 'block';
      detailBox.innerHTML = failures.map((f, idx) => `
        <div class="item">
          <div>
            <div><strong>${f.title}</strong></div>
            <div class="badge">${f.file || ''} • ${f.severity || 'high'}</div>
            <div class="stack">${(f.stack || '').slice(0, 200)}</div>
            <button class="btn" data-stack="${encodeURIComponent(f.stack || '')}" data-stack-open="${idx}">Apri stacktrace</button>
          </div>
        </div>
      `).join('');
    } else {
      detailPanel.style.display = 'none';
      detailBox.innerHTML = '';
    }
  }

  function renderTrend() {
    const svg = document.getElementById('trend-chart');
    if (!svg) return;
    const weeks = 8;
    const buckets = Array.from({ length: weeks }, () => 0);
    const now = new Date();
    data.forEach(r => {
      const d = new Date(r.date);
      const diffWeeks = Math.floor((now - d) / (1000 * 60 * 60 * 24 * 7));
      if (diffWeeks >= 0 && diffWeeks < weeks) buckets[weeks - diffWeeks - 1] += 1;
    });
    const max = Math.max(1, ...buckets);
    const barW = 800 / weeks;
    const bars = buckets.map((v, i) => {
      const h = Math.round((v / max) * 90);
      const x = i * barW + 8;
      const y = 110 - h;
      return `<rect x="${x}" y="${y}" width="${barW - 16}" height="${h}" rx="6" fill="#d6804f"></rect>`;
    }).join('');
    svg.innerHTML = `<rect width="800" height="120" fill="transparent"></rect>${bars}`;
  }

  function renderSeverityMap() {
    const svg = document.getElementById('severity-chart');
    if (!svg) return;
    const items = data.slice(0, 8).reverse();
    const barW = 800 / 8;
    const bars = items.map((r, i) => {
      const counts = r.summary?.severityCounts || { high: 0, medium: 0, low: 0 };
      const total = Math.max(1, (counts.high + counts.medium + counts.low));
      const hHigh = Math.round((counts.high / total) * 100);
      const hMed = Math.round((counts.medium / total) * 100);
      const hLow = 100 - hHigh - hMed;
      const x = i * barW + 10;
      const w = barW - 20;
      const yLow = 120 - hLow;
      const yMed = yLow - hMed;
      const yHigh = yMed - hHigh;
      return `
        <rect x="${x}" y="${yHigh}" width="${w}" height="${hHigh}" fill="#b91c1c" rx="6"></rect>
        <rect x="${x}" y="${yMed}" width="${w}" height="${hMed}" fill="#d97706" rx="6"></rect>
        <rect x="${x}" y="${yLow}" width="${w}" height="${hLow}" fill="#15803d" rx="6"></rect>
      `;
    }).join('');
    svg.innerHTML = `<rect width="800" height="120" fill="transparent"></rect>${bars}`;
  }

  function renderFailureTrend() {
    const svg = document.getElementById('trend-chart');
    if (!svg) return;
    // overlay a red line for failures (reuse trend chart height)
    const items = data.slice(0, 8).reverse();
    const max = Math.max(1, ...items.map(r => r.summary?.failed || 0));
    const points = items.map((r, i) => {
      const x = (i * (800 / 8)) + (800 / 16);
      const y = 110 - Math.round(((r.summary?.failed || 0) / max) * 90);
      return `${x},${y}`;
    }).join(' ');
    svg.innerHTML += `<polyline points="${points}" fill="none" stroke="#b91c1c" stroke-width="3" />`;
  }

  async function renderAudit() {
    if (!isAdmin) return;
    const panel = document.getElementById('audit-panel');
    const list = document.getElementById('audit-list');
    const exportBtn = document.getElementById('audit-export');
    panel.style.display = 'block';
    try {
      const res = await fetch('/.netlify/functions/audit', { cache: 'no-store' });
      const json = await res.json();
      const logs = (json.logs || []).slice(-10).reverse();
      list.innerHTML = logs.length
        ? logs.map(l => `<div>${new Date(l.ts).toLocaleString('it-IT')} • ${l.email} • ${l.action}</div>`).join('')
        : '<div class="muted">Nessun accesso registrato oggi.</div>';
      if (exportBtn) {
        exportBtn.onclick = async () => {
          const csvRes = await fetch('/.netlify/functions/audit?format=csv', { cache: 'no-store' });
          const csv = await csvRes.text();
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = 'audit_reports.csv';
          link.click();
        };
      }
      const exportJsonBtn = document.getElementById('audit-export-json');
      if (exportJsonBtn) {
        exportJsonBtn.onclick = async () => {
          const res = await fetch('/.netlify/functions/audit_export', { cache: 'no-store' });
          const json = await res.text();
          const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = 'audit_reports.json';
          link.click();
        };
      }
    } catch {
      list.innerHTML = '<div class="muted">Audit non disponibile.</div>';
    }
  }

  async function refresh() {
    await fetchData();
    render();
    await renderAudit();
    await renderFlaky();
    await renderWeekly();
  }

  // Stack modal
  const modal = document.getElementById('stack-modal');
  const modalContent = document.getElementById('stack-content');
  const modalClose = document.getElementById('stack-close');
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-stack-open]');
    if (!btn) return;
    const raw = decodeURIComponent(btn.getAttribute('data-stack') || '');
    modalContent.textContent = raw || 'Nessuno stack disponibile';
    modal.classList.remove('hidden');
  });
  modalClose.addEventListener('click', () => modal.classList.add('hidden'));

  document.getElementById('filter-btn').addEventListener('click', render);

  if (window.netlifyIdentity) {
    window.netlifyIdentity.init();
    window.netlifyIdentity.on('init', user => {
      const roles = (user && user.app_metadata && user.app_metadata.roles) || [];
      isAdmin = roles.includes('admin');
      autoWrap.style.display = isAdmin ? 'block' : 'none';
      if (isAdmin) {
        autoEl.addEventListener('change', () => {
          if (autoEl.checked) {
            timer = setInterval(refresh, 30000);
          } else {
            if (timer) clearInterval(timer);
          }
        });
      }
    });
  }

  async function renderFlaky() {
    if (!isAdmin) return;
    const panel = document.getElementById('flaky-panel');
    const list = document.getElementById('flaky-list');
    try {
      const res = await fetch('/.netlify/functions/flaky', { cache: 'no-store' });
      const json = await res.json();
      if (!json.length) {
        panel.style.display = 'none';
        list.innerHTML = '';
        return;
      }
      panel.style.display = 'block';
      list.innerHTML = json.map(f => `
        <div class="item">
          <div>
            <div><strong>${f.title}</strong></div>
            <div class="badge">${f.file || ''}</div>
          </div>
          <div class="muted">${(f.statuses || []).join(', ')}</div>
        </div>
      `).join('');
    } catch {
      panel.style.display = 'none';
      list.innerHTML = '';
    }
  }

  async function renderWeekly() {
    const list = document.getElementById('weekly-list');
    if (!list) return;
    try {
      const res = await fetch('/reports/weekly.json', { cache: 'no-store' });
      const json = await res.json();
      list.innerHTML = json.map(w => `
        <div class="item">
          <div><strong>Settimana ${w.week}</strong></div>
          <div class="muted">Tot: ${w.total} | Pass: ${w.passed} | Fail: ${w.failed}</div>
        </div>
      `).join('');
    } catch {
      list.innerHTML = '<div class="muted">Nessun dato settimanale.</div>';
    }
  }

  await refresh();
}

loadReports();
