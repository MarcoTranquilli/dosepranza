import fs from 'fs/promises';
import { getStore } from '@netlify/blobs';

const store = getStore('uat-reports');
let index = [];
try {
  index = await store.getJSON('index.json') || [];
} catch {
  index = [];
}

const weeks = {};
index.forEach(r => {
  const d = new Date(r.date);
  const week = new Date(d);
  week.setDate(d.getDate() - d.getDay());
  const key = week.toISOString().slice(0, 10);
  if (!weeks[key]) weeks[key] = { week: key, total: 0, failed: 0, passed: 0 };
  weeks[key].total += 1;
  if ((r.summary?.status || 'pass') === 'fail') weeks[key].failed += 1;
  else weeks[key].passed += 1;
});

const out = Object.values(weeks).sort((a, b) => (a.week < b.week ? 1 : -1));
await store.setJSON('reports/weekly.json', out);
await fs.writeFile('reports/weekly.json', JSON.stringify(out, null, 2));
console.log('Weekly aggregate saved.');
