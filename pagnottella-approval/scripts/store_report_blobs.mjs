import { getStore } from '@netlify/blobs';
import fs from 'fs/promises';

const store = getStore('uat-reports');

const now = new Date();
const date = now.toISOString().slice(0, 10);
const label = `UAT ${date}`;

const pdfPath = 'playwright-report/uat-report.pdf';
const pdf = await fs.readFile(pdfPath);
let summary = { status: 'pass', tests: 0, passed: 0, failed: 0, skipped: 0, failures: [] };

try {
  const raw = await fs.readFile('playwright-report/results.json', 'utf8');
  const json = JSON.parse(raw);
  const stats = json?.stats || {};
  const failures = [];
  (json?.suites || []).forEach(suite => {
    (suite.specs || []).forEach(spec => {
      (spec.tests || []).forEach(t => {
        (t.results || []).forEach(r => {
          if (r.status === 'failed') {
            const msg = (r.error?.message || '').toLowerCase();
            let severity = 'high';
            if (msg.includes('timeout')) severity = 'medium';
            if (msg.includes('expect') || msg.includes('to have')) severity = 'low';
            const stack = r.error?.stack || '';
            failures.push({
              title: spec.title,
              file: spec.file,
              error: r.error?.message || 'Errore sconosciuto',
              severity,
              stack
            });
          }
        });
      });
    });
  });
  const severityCounts = failures.reduce((acc, f) => {
    acc[f.severity || 'high'] = (acc[f.severity || 'high'] || 0) + 1;
    return acc;
  }, { high: 0, medium: 0, low: 0 });

  // Store failures.json in blobs for dashboard usage
  try {
    const failKey = `reports/failures/failures-${date}.json`;
    await store.setJSON(failKey, failures);
  } catch {
    // ignore
  }
  summary = {
    status: stats.unexpected > 0 ? 'fail' : 'pass',
    tests: stats.total || 0,
    passed: stats.passed || 0,
    failed: stats.unexpected || 0,
    skipped: stats.skipped || 0,
    failures,
    severityCounts
  };
} catch {
  // keep default summary if json not available
}

const key = `reports/history/${date}/uat-report.pdf`;
const latestKey = 'reports/latest.pdf';

await store.set(key, pdf, { contentType: 'application/pdf' });
await store.set(latestKey, pdf, { contentType: 'application/pdf' });

let index = [];
try {
  index = await store.getJSON('index.json') || [];
} catch {
  index = [];
}

index = index.filter((e) => e.date !== `${date}T00:00:00Z`);
index.push({ date: `${date}T00:00:00Z`, label, key, summary });
index.sort((a, b) => (a.date < b.date ? 1 : -1));

await store.setJSON('index.json', index);

console.log(`Stored report in Blobs: ${key}`);
