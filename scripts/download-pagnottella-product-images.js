#!/usr/bin/env node
/*
 * Download immagini prodotto La Pagnottella Gourmet.
 * Uso:
 *   node scripts/download-pagnottella-product-images.js
 *   node scripts/download-pagnottella-product-images.js --mapping assets/pagnottella/data/product-images.json
 *
 * Compilare original_image_url nella mappatura prima dell'esecuzione quando gli URL pubblici sono disponibili.
 */
const fs = require('fs');
const path = require('path');
const { setTimeout: delay } = require('timers/promises');

const ROOT = process.cwd();
const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const idx = args.indexOf(name);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
};

const mappingPath = path.resolve(ROOT, getArg('--mapping', 'assets/pagnottella/data/product-images.json'));
const outputDir = path.resolve(ROOT, getArg('--out', 'assets/pagnottella/images/products'));
const dataOut = path.resolve(ROOT, getArg('--data-out', 'assets/pagnottella/data/product-images.generated.json'));
const reportOut = path.resolve(ROOT, getArg('--report', 'assets/pagnottella/data/product-images-download-report.json'));
const timeoutMs = Number(getArg('--timeout', '20000'));
const retries = Number(getArg('--retries', '2'));

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readMapping(file) {
  if (!fs.existsSync(file)) throw new Error(`Mapping non trovato: ${file}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': 'DOSepranza-image-downloader/1.0'
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const type = res.headers.get('content-type') || '';
    if (!type.startsWith('image/')) throw new Error(`Content-Type non immagine: ${type || 'n/d'}`);
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } finally {
    clearTimeout(timer);
  }
}

async function downloadOne(item, seenUrls) {
  const url = item.original_image_url;
  const filename = item.suggested_filename;
  const target = path.join(outputDir, filename);
  const result = {
    product_id: item.product_id,
    product_name: item.product_name,
    mapping_type: item.mapping_type,
    confidence: item.confidence,
    needs_supplier_confirmation: item.needs_supplier_confirmation,
    original_image_url: url,
    output_file: path.relative(ROOT, target),
    status: 'pending',
    error: null,
    duplicate_of: null
  };

  if (!isHttpUrl(url)) {
    result.status = 'missing_url';
    result.error = 'original_image_url vuoto o non valido';
    return result;
  }

  if (seenUrls.has(url)) {
    const first = seenUrls.get(url);
    result.status = 'duplicate_url';
    result.duplicate_of = first;
    if (!fs.existsSync(target) && fs.existsSync(path.resolve(ROOT, first))) {
      fs.copyFileSync(path.resolve(ROOT, first), target);
      result.status = 'copied_duplicate';
    }
    return result;
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const buffer = await fetchWithTimeout(url);
      fs.writeFileSync(target, buffer);
      seenUrls.set(url, result.output_file);
      result.status = 'downloaded';
      result.bytes = buffer.length;
      return result;
    } catch (err) {
      result.error = err && err.message ? err.message : String(err);
      if (attempt < retries) await delay(750 * (attempt + 1));
    }
  }

  result.status = 'failed';
  return result;
}

async function main() {
  ensureDir(outputDir);
  ensureDir(path.dirname(dataOut));
  const mapping = readMapping(mappingPath);
  const seenUrls = new Map();
  const report = [];

  for (const item of mapping) {
    const result = await downloadOne(item, seenUrls);
    report.push(result);
    const marker = result.status === 'downloaded' ? 'OK' : result.status.toUpperCase();
    console.log(`${marker} ${item.product_name} -> ${result.output_file}`);
  }

  const generated = mapping.map((item) => ({
    product_id: item.product_id,
    product_name: item.product_name,
    category: item.category,
    image: item.local_path,
    source_filename: item.source_filename,
    mapping_type: item.mapping_type,
    confidence: item.confidence,
    needs_supplier_confirmation: item.needs_supplier_confirmation,
    notes: item.notes
  }));

  fs.writeFileSync(dataOut, JSON.stringify(generated, null, 2));
  fs.writeFileSync(reportOut, JSON.stringify({
    generated_at: new Date().toISOString(),
    mapping: path.relative(ROOT, mappingPath),
    output_dir: path.relative(ROOT, outputDir),
    totals: {
      items: report.length,
      downloaded: report.filter(r => r.status === 'downloaded').length,
      failed: report.filter(r => r.status === 'failed').length,
      missing_url: report.filter(r => r.status === 'missing_url').length,
      duplicate: report.filter(r => r.status.includes('duplicate')).length
    },
    report
  }, null, 2));

  console.log(`\nDati app: ${path.relative(ROOT, dataOut)}`);
  console.log(`Report: ${path.relative(ROOT, reportOut)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
