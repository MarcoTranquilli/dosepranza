import fs from 'fs/promises';
import fetch from 'node-fetch';
import FormData from 'form-data';

const token = process.env.SLACK_BOT_TOKEN;
const channel = process.env.SLACK_CHANNEL_ID;

if (!token || !channel) {
  console.log('SLACK_BOT_TOKEN or SLACK_CHANNEL_ID not set. Skipping file upload.');
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

if (summary.failed === 0 && process.env.SLACK_FILE_ALWAYS !== '1') {
  console.log('No failures detected. Skipping Slack file upload (SLACK_FILE_ALWAYS=1 to override).');
  process.exit(0);
}

const file = await fs.readFile('playwright-report/uat-report.pdf');

const form = new FormData();
form.append('channels', channel);
form.append('file', file, { filename: 'uat-report.pdf', contentType: 'application/pdf' });
form.append('filename', 'uat-report.pdf');
form.append('title', 'UAT Report');

await fetch('https://slack.com/api/files.upload', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: form
});

console.log('Slack file uploaded.');
