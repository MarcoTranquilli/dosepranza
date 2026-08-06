import fs from 'fs/promises';
import fetch from 'node-fetch';

const webhook = process.env.SLACK_WEBHOOK_URL;
const baseUrl = process.env.REPORT_BASE_URL || '';

if (!webhook) {
  console.log('SLACK_WEBHOOK_URL not set. Skipping Slack alert.');
  process.exit(0);
}

let summary = { status: 'pass', tests: 0, passed: 0, failed: 0, skipped: 0 };
try {
  const raw = await fs.readFile('playwright-report/results.json', 'utf8');
  const json = JSON.parse(raw);
  const stats = json?.stats || {};
  summary = {
    status: stats.unexpected > 0 ? 'fail' : 'pass',
    tests: stats.total || 0,
    passed: stats.passed || 0,
    failed: stats.unexpected || 0,
    skipped: stats.skipped || 0
  };
} catch {}

if (summary.failed === 0) {
  console.log('No failures. Slack alert skipped.');
  process.exit(0);
}

let severityCounts = { high: 0, medium: 0, low: 0 };
try {
  const raw = await fs.readFile('playwright-report/results.json', 'utf8');
  const json = JSON.parse(raw);
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
            failures.push({ severity });
          }
        });
      });
    });
  });
  severityCounts = failures.reduce((acc, f) => {
    acc[f.severity] = (acc[f.severity] || 0) + 1;
    return acc;
  }, { high: 0, medium: 0, low: 0 });
} catch {}

const text = `*UAT FAIL*\nTests: ${summary.tests} | Passed: ${summary.passed} | Failed: ${summary.failed}\nSeverity: High ${severityCounts.high} • Medium ${severityCounts.medium} • Low ${severityCounts.low}\nReport: ${baseUrl}/reports\nPDF: ${baseUrl}/.netlify/functions/report?key=reports/latest.pdf`;

await fetch(webhook, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text })
});

// Escalation for high severity
const escalateWebhook = process.env.SLACK_ESCALATION_WEBHOOK_URL;
if (severityCounts.high > 0 && escalateWebhook) {
  const escText = `*UAT HIGH SEVERITY*\nHigh: ${severityCounts.high}\nReport: ${baseUrl}/reports`;
  await fetch(escalateWebhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: escText })
  });
  console.log('Slack escalation sent.');
}

console.log('Slack alert sent.');
