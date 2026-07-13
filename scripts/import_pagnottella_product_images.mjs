import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const menuPath = resolve(root, 'assets/pagnottella/data/menu.json');
const completePath = resolve(root, 'assets/pagnottella/data/source/mappatura_prodotti_completa.json');
const associatedPath = resolve(root, 'assets/pagnottella/data/source/product_image_map.json');
const outputMapPath = resolve(root, 'assets/pagnottella/data/product-image-map.json');
const imageDir = resolve(root, 'assets/pagnottella/images/products');

mkdirSync(imageDir, { recursive: true });

const menu = JSON.parse(readFileSync(menuPath, 'utf8'));
const complete = JSON.parse(readFileSync(completePath, 'utf8'));
const associated = JSON.parse(readFileSync(associatedPath, 'utf8'));

const slugify = value => value
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

const categoryHeroOverrides = {
  all: '../assets/pagnottella/images/products/insalata_apollo.jpg',
  'panini-carne': '../assets/pagnottella/images/products/panino_saporito.jpg',
  'panini-pesce': '../assets/pagnottella/images/products/panino_baccala.jpg',
  'panini-veg': '../assets/pagnottella/images/products/panino_burrata.jpg',
  'insalate-carne': '../assets/pagnottella/images/optimized/vitella_insalata.webp',
  'insalate-pesce': '../assets/pagnottella/images/products/insalata_baccala.jpg',
  'insalate-veg': '../assets/pagnottella/images/products/insalata_reginella.jpg',
  speciali: '../assets/pagnottella/images/products/insalata_apollo.jpg'
};

const localPathFor = filename => `../assets/pagnottella/images/products/${filename}`;

const curated = new Map();

for (const row of complete) {
  if (!row.image_url) continue;
  if (!['alta', 'media'].includes((row.confidence || '').toLowerCase())) continue;
  const type = row.product_type?.toLowerCase().startsWith('panini') ? 'panino' : 'insalata';
  const key = `${slugify(row.product_name)}|${type}`;
  curated.set(key, {
    productName: row.product_name,
    type,
    confidence: row.confidence.toLowerCase(),
    source: 'complete',
    filename: row.suggested_image_filename,
    imageUrl: row.image_url,
    notes: row.notes,
    basis: row.mapping_basis
  });
}

for (const row of associated) {
  const confidence = (row.confidence || '').toLowerCase();
  if (!['alta', 'media'].includes(confidence)) continue;
  const type = row.category?.toLowerCase().startsWith('pan') ? 'panino' : 'insalata';
  const key = `${slugify(row.product_name)}|${type}`;
  if (curated.has(key)) continue;
  curated.set(key, {
    productName: row.product_name,
    type,
    confidence,
    source: 'associated',
    filename: row.suggested_filename,
    imageUrl: row.image_url,
    notes: row.menu_notes,
    basis: row.association_basis
  });
}

const results = [];
const downloadQueue = new Map();

for (const product of menu.products) {
  const type = inferType(product.cat);
  const key = `${slugify(product.name)}|${type}`;
  const match = curated.get(key);
  if (!match) {
    product.imageMeta = {
      specific: false,
      source: 'fallback',
      confidence: 'nessuna',
      label: 'Immagine categoria'
    };
    continue;
  }
  product.img = localPathFor(match.filename);
  product.imageMeta = {
    specific: true,
    source: match.source,
    confidence: match.confidence,
    label: match.confidence === 'alta' ? 'Foto prodotto' : 'Foto associata',
    originalUrl: match.imageUrl,
    filename: match.filename,
    basis: match.basis,
    notes: match.notes
  };
  results.push({
    name: product.name,
    cat: product.cat,
    filename: match.filename,
    source: match.source,
    confidence: match.confidence,
    imageUrl: match.imageUrl
  });
  downloadQueue.set(match.filename, match.imageUrl);
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

for (const category of menu.cats) {
  if (categoryHeroOverrides[category.id]) category.hero = categoryHeroOverrides[category.id];
}

const heroByCategory = Object.fromEntries(menu.cats.map(category => [category.id, category.hero]));
for (const product of menu.products) {
  if (!product.imageMeta?.specific && heroByCategory[product.cat]) {
    product.img = heroByCategory[product.cat];
  }
}

writeFileSync(menuPath, JSON.stringify(menu, null, 2) + '\n');
writeFileSync(outputMapPath, JSON.stringify(results, null, 2) + '\n');

console.log(`Updated ${results.length} product images`);
