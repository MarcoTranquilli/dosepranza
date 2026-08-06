import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const menuPath = resolve(root, 'assets/pagnottella/data/menu.json');
const coveragePath = resolve(root, 'assets/pagnottella/data/source-audit-completo/prodotti_coverage_87.json');
const imageDirectory = resolve(root, 'assets/pagnottella/images/products');
const outputPath = resolve(root, 'assets/pagnottella/data/product-image-map.json');
const fallbackImage = '../assets/pagnottella/images/optimized/logo_pagnottella.webp';

const menu = JSON.parse(readFileSync(menuPath, 'utf8'));
const coverage = JSON.parse(readFileSync(coveragePath, 'utf8'));
const localImages = readdirSync(imageDirectory);

const slugify = (value) => String(value || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const productType = (category) => {
  if (category.startsWith('panini')) return 'panini';
  if (category.startsWith('insalate')) return 'insalate';
  return '';
};

const coverageIndex = new Map(coverage.map((row) => [
  `${slugify(row.product_type)}|${slugify(row.product_name)}`,
  row
]));

function localSpecificImage(row) {
  const suffix = `__${row.file_specifico}`;
  const filename = localImages.find((candidate) => candidate.endsWith(suffix));
  if (!filename) throw new Error(`Asset locale mancante per ${row.product_name}: ${row.file_specifico}`);
  return { filename, path: `../assets/pagnottella/images/products/${filename}` };
}

const results = [];
for (const product of menu.products) {
  const type = productType(product.cat);
  const row = type ? coverageIndex.get(`${type}|${slugify(product.name)}`) : null;
  const publishable = row?.pubblicabile === 'si' && row?.file_specifico;

  if (publishable) {
    const image = localSpecificImage(row);
    product.img = image.path;
    product.imageMeta = {
      assigned: true,
      specific: true,
      source: 'audit-completo',
      confidence: row.confidenza_asset || row.confidence || 'alta',
      label: 'Foto prodotto verificata',
      mappingType: 'foto_specifica_verificata',
      originalUrl: row.image_url,
      filename: image.filename,
      basis: row.mapping_basis || row.notes,
      needsSupplierConfirmation: false,
      sourcePage: row.image_source_page,
      sourceAsset: row.image_asset_key,
      assetId: row.asset_id_specifico,
      auditPublishable: true
    };
  } else {
    product.img = fallbackImage;
    product.imageMeta = {
      assigned: false,
      specific: false,
      source: 'audit-completo',
      confidence: 'nessuna',
      label: 'Foto specifica non disponibile',
      mappingType: 'nessuna_foto_specifica',
      basis: row?.notes || 'Il catalogo pubblico non espone una fotografia univoca per questo prodotto.',
      needsSupplierConfirmation: false,
      requiresSupplierPhoto: true,
      auditPublishable: false
    };
  }

  results.push({
    id: product.id,
    name: product.name,
    category: product.cat,
    image: product.img,
    specific: product.imageMeta.specific,
    auditPublishable: product.imageMeta.auditPublishable,
    sourceAsset: product.imageMeta.sourceAsset || null
  });
}

const specificImageFor = (name, categoryPrefix) => {
  const product = menu.products.find(item => item.name.toLowerCase() === name.toLowerCase() && item.cat.startsWith(categoryPrefix));
  return product?.imageMeta?.specific ? product.img : fallbackImage;
};

const categoryHeroes = {
  all: fallbackImage,
  'panini-carne': specificImageFor('Saporito', 'panini'),
  'panini-pesce': specificImageFor('Baccala', 'panini-pesce'),
  'panini-veg': specificImageFor('Burrata', 'panini-veg'),
  'insalate-carne': fallbackImage,
  'insalate-pesce': specificImageFor('Baccala', 'insalate-pesce'),
  'insalate-veg': specificImageFor('Reginella', 'insalate-veg'),
  speciali: fallbackImage,
  'bevande-dolci': fallbackImage,
  'succhi-freschi': fallbackImage
};

for (const category of menu.cats) {
  category.hero = categoryHeroes[category.id] || fallbackImage;
}

writeFileSync(menuPath, `${JSON.stringify(menu, null, 2)}\n`);
writeFileSync(outputPath, `${JSON.stringify(results, null, 2)}\n`);

const specificCount = results.filter(item => item.specific).length;
console.log(`Audit immagini applicato: ${specificCount} foto specifiche verificate, ${results.length - specificCount} fallback neutri.`);
