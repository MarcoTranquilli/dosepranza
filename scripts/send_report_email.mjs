import fs from 'fs/promises';
import fetch from 'node-fetch';

const apiKey = process.env.SENDGRID_API_KEY;
const to = process.env.REPORT_EMAIL_TO;
const from = process.env.REPORT_EMAIL_FROM;
const baseUrl = process.env.REPORT_BASE_URL || '';

if (!apiKey || !to || !from) {
  console.log('Email not configured. Skipping.');
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

const subject = `UAT Report (${summary.status.toUpperCase()})`;
const text = `Report UAT generato.\nStatus: ${summary.status}\nTests: ${summary.tests}\nPassed: ${summary.passed}\nFailed: ${summary.failed}\nSkipped: ${summary.skipped}\n\nReport: ${baseUrl}/reports\nPDF: ${baseUrl}/.netlify/functions/report?key=reports/latest.pdf`;
if (summary.failed === 0 && process.env.REPORT_EMAIL_ALWAYS !== '1') {
  console.log('No failures detected. Skipping email (REPORT_EMAIL_ALWAYS=1 to override).');
  process.exit(0);
}

const pdf = await fs.readFile('playwright-report/uat-report.pdf');

await fetch('https://api.sendgrid.com/v3/mail/send', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    personalizations: [{ to: [{ email: to }] }],
    from: { email: from },
    subject,
    content: [{ type: 'text/plain', value: text }],
    attachments: [
      {
        content: pdf.toString('base64'),
        filename: 'uat-report.pdf',
        type: 'application/pdf',
        disposition: 'attachment'
      }
    ]
  })
});

console.log('UAT email sent.');
