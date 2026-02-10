import fs from 'fs/promises';
import fetch from 'node-fetch';

const webhook = process.env.TEAMS_WEBHOOK_URL;
const baseUrl = process.env.REPORT_BASE_URL || '';

if (!webhook) {
  console.log('TEAMS_WEBHOOK_URL not set. Skipping Teams alert.');
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
  console.log('No failures. Teams alert skipped.');
  process.exit(0);
}

const card = {
  '$schema': 'http://adaptivecards.io/schemas/adaptive-card.json',
  type: 'AdaptiveCard',
  version: '1.3',
  body: [
    { type: 'TextBlock', size: 'Large', weight: 'Bolder', text: 'UAT FAIL' },
    { type: 'FactSet', facts: [
      { title: 'Tests', value: summary.tests.toString() },
      { title: 'Passed', value: summary.passed.toString() },
      { title: 'Failed', value: summary.failed.toString() }
    ]},
    { type: 'TextBlock', text: `Report: ${baseUrl}/reports`, wrap: true },
    { type: 'TextBlock', text: `PDF: ${baseUrl}/.netlify/functions/report?key=reports/latest.pdf`, wrap: true }
  ]
};

await fetch(webhook, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'message', attachments: [{ contentType: 'application/vnd.microsoft.card.adaptive', content: card }] })
});

console.log('Teams alert sent.');
