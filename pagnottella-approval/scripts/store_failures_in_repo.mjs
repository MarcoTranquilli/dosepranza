import fs from 'fs/promises';
import path from 'path';

const outDir = 'reports/failures';
await fs.mkdir(outDir, { recursive: true });

const raw = await fs.readFile('playwright-report/results.json', 'utf8');
const json = JSON.parse(raw);
const date = new Date().toISOString().slice(0, 10);
const failures = [];

(json?.suites || []).forEach(suite => {
  (suite.specs || []).forEach(spec => {
    (spec.tests || []).forEach(t => {
      (t.results || []).forEach(r => {
        if (r.status === 'failed') {
          failures.push({
            title: spec.title,
            file: spec.file,
            error: r.error?.message || 'Errore sconosciuto',
            stack: r.error?.stack || ''
          });
        }
      });
    });
  });
});

if (failures.length) {
  const outPath = path.join(outDir, `failures-${date}.json`);
  await fs.writeFile(outPath, JSON.stringify(failures, null, 2));
  console.log(`Failures saved to ${outPath}`);
} else {
  console.log('No failures. No file saved.');
}
