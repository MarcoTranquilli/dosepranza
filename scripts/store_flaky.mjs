import fs from 'fs/promises';
import { getStore } from '@netlify/blobs';

const store = getStore('uat-reports');
const raw = await fs.readFile('playwright-report/results.json', 'utf8');
const json = JSON.parse(raw);
const date = new Date().toISOString().slice(0, 10);

const flaky = [];
(json?.suites || []).forEach(suite => {
  (suite.specs || []).forEach(spec => {
    (spec.tests || []).forEach(t => {
      const statuses = (t.results || []).map(r => r.status);
      if (statuses.includes('failed') && statuses.includes('passed')) {
        flaky.push({ title: spec.title, file: spec.file, statuses });
      }
    });
  });
});

await store.setJSON(`reports/flaky/flaky-${date}.json`, flaky);
await store.setJSON('reports/flaky/latest.json', flaky);
console.log(`Flaky tests stored: ${flaky.length}`);
