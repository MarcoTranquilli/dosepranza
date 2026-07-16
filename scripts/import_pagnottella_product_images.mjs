import { mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const menuPath = resolve(root, 'assets/pagnottella/data/menu.json');
const mappingPath = resolve(root, 'assets/pagnottella/data/source-1to1/mappatura_1a1_prodotti_immagini.json');
const outputMapPath = resolve(root, 'assets/pagnottella/data/product-image-map.json');
const imageDir = resolve(root, 'assets/pagnottella/images/products');

mkdirSync(imageDir, { recursive: true });

const menu = JSON.parse(readFileSync(menuPath, 'utf8'));
const mapping = JSON.parse(readFileSync(mappingPath, 'utf8'));

const slugify = value => String(value || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const inferType = cat => {
  if (cat.startsWith('panini')) return 'panino';
  if (cat.startsWith('insalate') || cat === 'speciali') return 'insalata';
  return 'other';
};

const localPathFor = filename => `../assets/pagnottella/images/products/${filename}`;

const categoryHeroOverrides = {
  all: '../assets/pagnottella/images/products/insalata_apollo.jpg',
  'panini-carne': '../assets/pagnottella/images/products/panini_saporito__panino_saporito.jpg',
  'panini-pesce': '../assets/pagnottella/images/products/panini_baccala__panino_baccala.jpg',
  'panini-veg': '../assets/pagnottella/images/products/panini_burrata__panino_burrata.jpg',
  'insalate-carne': '../assets/pagnottella/images/products/insalate_leggera__asset_home_vitella_insalata.jpg',
  'insalate-pesce': '../assets/pagnottella/images/products/insalate_baccala__insalata_baccala.jpg',
  'insalate-veg': '../assets/pagnottella/images/products/insalate_reginella__insalata_reginella.jpg',
  speciali: '../assets/pagnottella/images/products/insalata_apollo.jpg'
};

const strictSpecificMatches = new Set([
  'saporito|panino',
  'tartare|panino',
  'toscanaccio|panino',
  'baccala|panino',
  'burrata|panino',
  'baccala|insalata',
  'cefalu|insalata',
  'salentina|insalata',
  'trapanese|insalata',
  'reginella|insalata',
  'apollo|insalata'
]);

const normalizeMappingForPreview = (row, key) => {
  const normalized = { ...row };
  if (normalized.mapping_type !== 'foto_specifica_o_quasi_specifica') return normalized;
  if (strictSpecificMatches.has(key)) return normalized;
  normalized.mapping_type = 'riuso_affine_per_ingrediente';
  normalized.confidence = 'bassa';
  normalized.needs_supplier_confirmation = 'si';
  normalized.assignment_reason = `Preview conservativa: immagine mantenuta come riuso affine, non come foto specifica verificata dal sito. ${normalized.assignment_reason || ''}`.trim();
  return normalized;
};

const mappingLabel = row => {
  switch (row.mapping_type) {
    case 'foto_specifica_o_quasi_specifica':
      return 'Foto prodotto';
    case 'riuso_affine_per_ingrediente':
      return 'Foto associata';
    default:
      return 'Foto categoria';
  }
};

const mappingDetails = row => ({
  assigned: true,
  specific: row.mapping_type === 'foto_specifica_o_quasi_specifica',
  source: 'mapping-1to1',
  confidence: row.confidence?.toLowerCase() || 'bassa',
  label: mappingLabel(row),
  mappingType: row.mapping_type,
  originalUrl: row.assigned_image_url,
  filename: row.assigned_image_filename,
  basis: row.assignment_reason,
  needsSupplierConfirmation: String(row.needs_supplier_confirmation || '').toLowerCase() === 'si',
  sourcePage: row.source_page,
  sourceAsset: row.source_image_asset_key,
  sourceOriginalFilename: row.source_original_filename
});

const mappingIndex = new Map();
for (const row of mapping) {
  const type = row.product_type?.toLowerCase().startsWith('panini') ? 'panino' : 'insalata';
  const key = `${slugify(row.product_name)}|${type}`;
  mappingIndex.set(key, row);
}

const results = [];
const downloadQueue = new Map();

for (const product of menu.products) {
  const type = inferType(product.cat);
  const key = `${slugify(product.name)}|${type}`;
  const rawRow = mappingIndex.get(key);
  const row = rawRow ? normalizeMappingForPreview(rawRow, key) : null;

  if (!row) {
    if (product.name === 'Apollo' && product.cat === 'speciali') {
      product.img = '../assets/pagnottella/images/products/insalata_apollo.jpg';
      product.imageMeta = {
        assigned: true,
        specific: true,
        source: 'associated-home',
        confidence: 'alta',
        label: 'Foto prodotto',
        mappingType: 'foto_specifica_o_quasi_specifica',
        originalUrl: 'https://images.squarespace-cdn.com/content/v1/5bc46325d7819e67da2eef74/1733913541674-LEKZU93QZGKVQJ2LGHN2/apollo_3.jpg',
        filename: 'insalata_apollo.jpg',
        basis: 'Asset home Apollo mantenuto come riferimento per lo speciale.',
        needsSupplierConfirmation: false,
        sourcePage: 'Home',
        sourceAsset: 'home_apollo'
      };
      downloadQueue.set('insalata_apollo.jpg', 'https://images.squarespace-cdn.com/content/v1/5bc46325d7819e67da2eef74/1733913541674-LEKZU93QZGKVQJ2LGHN2/apollo_3.jpg');
      results.push({
        name: product.name,
        cat: product.cat,
        filename: 'insalata_apollo.jpg',
        confidence: 'alta',
        mappingType: 'foto_specifica_o_quasi_specifica',
        imageUrl: 'https://images.squarespace-cdn.com/content/v1/5bc46325d7819e67da2eef74/1733913541674-LEKZU93QZGKVQJ2LGHN2/apollo_3.jpg',
        needsSupplierConfirmation: false
      });
      continue;
    }

    product.imageMeta = {
      assigned: false,
      specific: false,
      source: 'fallback',
      confidence: 'nessuna',
      label: 'Immagine categoria'
    };
    continue;
  }

  product.img = localPathFor(row.assigned_image_filename);
  product.imageMeta = mappingDetails(row);
  results.push({
    name: product.name,
    cat: product.cat,
    filename: row.assigned_image_filename,
    confidence: row.confidence?.toLowerCase() || 'bassa',
    mappingType: row.mapping_type,
    imageUrl: row.assigned_image_url,
    needsSupplierConfirmation: String(row.needs_supplier_confirmation || '').toLowerCase() === 'si'
  });
  downloadQueue.set(row.assigned_image_filename, row.assigned_image_url);
}

const fetchImage = async (filename, url) => {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; DOSepranza asset sync)'
    }
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  writeFileSync(resolve(imageDir, filename), buffer);
};

for (const [filename, url] of downloadQueue) {
  await fetchImage(filename, url);
}

for (const existingFile of readdirSync(imageDir)) {
  if (!downloadQueue.has(existingFile)) {
    unlinkSync(resolve(imageDir, existingFile));
  }
}

for (const category of menu.cats) {
  if (categoryHeroOverrides[category.id]) category.hero = categoryHeroOverrides[category.id];
}

const heroByCategory = Object.fromEntries(menu.cats.map(category => [category.id, category.hero]));
for (const product of menu.products) {
  if (!product.imageMeta?.assigned && heroByCategory[product.cat]) {
    product.img = heroByCategory[product.cat];
  }
}

writeFileSync(menuPath, JSON.stringify(menu, null, 2) + '\n');
writeFileSync(outputMapPath, JSON.stringify(results, null, 2) + '\n');

console.log(`Updated ${results.length} product image assignments`);
