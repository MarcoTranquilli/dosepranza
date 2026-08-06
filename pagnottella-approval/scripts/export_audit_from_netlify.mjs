import fetch from 'node-fetch';
import fs from 'fs/promises';

const base = process.env.REPORT_BASE_URL;
if (!base) {
  console.log('REPORT_BASE_URL not set. Skipping audit export.');
  process.exit(0);
}

const res = await fetch(`${base}/.netlify/functions/audit_export`);
if (!res.ok) {
  console.log('Audit export failed.');
  process.exit(1);
}

const json = await res.text();
await fs.writeFile('audit_export.json', json);
console.log('Audit JSON exported to audit_export.json');
