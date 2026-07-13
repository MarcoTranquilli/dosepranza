import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const menuPath = resolve(root, 'assets/pagnottella/data/menu.json');
const outDir = resolve(root, 'reports/generated');
const jsonPath = resolve(outDir, 'pagnottella-image-audit.json');
const csvPath = resolve(outDir, 'pagnottella-image-audit.csv');

mkdirSync(outDir, { recursive: true });

const menu = JSON.parse(readFileSync(menuPath, 'utf8'));

const rows = menu.products.map((product) => {
  const meta = product.imageMeta || {};
  return {
    id: product.id,
    name: product.name,
    category: product.cat,
    price: product.price,
    image: product.img || '',
    assigned: Boolean(meta.assigned),
    bucket: meta.mappingType || 'unassigned',
    specific: Boolean(meta.specific),
    confidence: meta.confidence || 'nessuna',
    needsSupplierConfirmation: Boolean(meta.needsSupplierConfirmation),
    label: meta.label || '',
    source: meta.source || '',
    basis: meta.basis || '',
    originalUrl: meta.originalUrl || '',
    filename: meta.filename || '',
    sourcePage: meta.sourcePage || '',
    sourceAsset: meta.sourceAsset || '',
  };
});

const bucketOrder = [
  'foto_specifica_o_quasi_specifica',
  'riuso_affine_per_ingrediente',
  'fallback_categoria',
  'unassigned'
];

const summary = rows.reduce((acc, row) => {
  acc.totalProducts += 1;
  acc.byBucket[row.bucket] = (acc.byBucket[row.bucket] || 0) + 1;
  acc.byConfidence[row.confidence] = (acc.byConfidence[row.confidence] || 0) + 1;
  if (row.needsSupplierConfirmation) acc.needsSupplierConfirmation += 1;
  if (row.specific) acc.specificAssignments += 1;
  return acc;
}, {
  generatedAt: new Date().toISOString(),
  totalProducts: 0,
  specificAssignments: 0,
  needsSupplierConfirmation: 0,
  byBucket: {},
  byConfidence: {}
});

const grouped = Object.fromEntries(
  bucketOrder.map((bucket) => [bucket, rows.filter((row) => row.bucket === bucket)])
);

const report = {
  summary,
  grouped,
  allRows: rows
};

const header = [
  'bucket',
  'category',
  'name',
  'id',
  'price',
  'confidence',
  'specific',
  'needs_supplier_confirmation',
  'assigned',
  'image',
  'filename',
  'source',
  'source_page',
  'source_asset',
  'label',
  'basis',
  'original_url'
];

const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const sortedRows = [...rows].sort((a, b) => {
  const bucketDelta = bucketOrder.indexOf(a.bucket) - bucketOrder.indexOf(b.bucket);
  if (bucketDelta !== 0) return bucketDelta;
  const catDelta = a.category.localeCompare(b.category, 'it');
  if (catDelta !== 0) return catDelta;
  return a.name.localeCompare(b.name, 'it');
});

const csv = [
  header.join(','),
  ...sortedRows.map((row) => [
    row.bucket,
    row.category,
    row.name,
    row.id,
    row.price,
    row.confidence,
    row.specific,
    row.needsSupplierConfirmation,
    row.assigned,
    row.image,
    row.filename,
    row.source,
    row.sourcePage,
    row.sourceAsset,
    row.label,
    row.basis,
    row.originalUrl
  ].map(csvEscape).join(','))
].join('\n');

writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n');
writeFileSync(csvPath, csv + '\n');

console.log(`Generated ${jsonPath}`);
console.log(`Generated ${csvPath}`);
console.log(JSON.stringify(summary, null, 2));
