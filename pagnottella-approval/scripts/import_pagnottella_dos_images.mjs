import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const root = resolve(import.meta.dirname, '..');
const sourceRoot = resolve(process.argv[2] || '/Users/marcotranquilli/Downloads/foto dos design');
const menuPath = resolve(root, 'assets/pagnottella/data/menu.json');
const imageDir = resolve(root, 'assets/pagnottella/images/products');
const manifestPath = resolve(root, 'assets/pagnottella/data/dos-supplier-image-manifest.json');
const mapPath = resolve(root, 'assets/pagnottella/data/product-image-map.json');
const galleryPath = resolve(root, 'reports/pagnottella-dos-images-20260806.html');
const expectedCount = 37;

const normalize = value => String(value || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/_cmyk$/i, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();
const slugify = value => normalize(value).replace(/ /g, '_');
const productKey = value => normalize(value).replace(/ /g, '');
const sha256 = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const html = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

if (!existsSync(sourceRoot)) throw new Error(`Cartella immagini non trovata: ${sourceRoot}`);
const menu = JSON.parse(readFileSync(menuPath, 'utf8'));
const existingMap = JSON.parse(readFileSync(mapPath, 'utf8'));
const productIndex = new Map(menu.products.map(product => [`${product.cat}|${productKey(product.name)}`, product]));
const sourceRows = ['panini', 'insalate'].flatMap(category => {
  const directory = join(sourceRoot, category);
  if (!existsSync(directory)) throw new Error(`Categoria sorgente mancante: ${directory}`);
  return readdirSync(directory)
    .filter(filename => /\.(jpe?g|png|webp)$/i.test(filename))
    .map(filename => ({category, filename, source:join(directory, filename)}));
});
if (sourceRows.length !== expectedCount) throw new Error(`Attese ${expectedCount} immagini, trovate ${sourceRows.length}.`);

mkdirSync(imageDir, {recursive:true});
mkdirSync(resolve(root, 'reports'), {recursive:true});
const manifest = [];
for (const row of sourceRows) {
  const stem = basename(row.filename, extname(row.filename)).replace(/_CMYK$/i, '');
  const product = productIndex.get(`${row.category}|${productKey(stem)}`);
  if (!product) throw new Error(`Prodotto non trovato per ${row.category}/${row.filename}`);

  const base = `${row.category}_${slugify(product.name)}__supplier_20260806`;
  const desktopFilename = `${base}.webp`;
  const mobileFilename = `${base}-640.webp`;
  const desktopTarget = join(imageDir, desktopFilename);
  const mobileTarget = join(imageDir, mobileFilename);
  let conversionSource = row.source;
  let temporaryRgb = '';
  if (/_CMYK/i.test(row.filename)) {
    temporaryRgb = join(tmpdir(), `${base}-${process.pid}.png`);
    execFileSync('sips', ['-s', 'format', 'png', row.source, '--out', temporaryRgb], {stdio:'ignore'});
    conversionSource = temporaryRgb;
  }
  const encode = (width, target) => execFileSync('cwebp', [
    '-quiet', '-mt', '-sharp_yuv', '-q', '82', '-resize', String(width), '0', conversionSource, '-o', target
  ]);
  encode(1200, desktopTarget);
  encode(640, mobileTarget);
  if (temporaryRgb && existsSync(temporaryRgb)) unlinkSync(temporaryRgb);

  const publicDesktop = `../assets/pagnottella/images/products/${desktopFilename}`;
  const publicMobile = `../assets/pagnottella/images/products/${mobileFilename}`;
  product.img = publicDesktop;
  product.imageMeta = {
    assigned: true,
    specific: true,
    source: 'fornitore-dos-20260806',
    confidence: 'alta',
    label: 'Foto specifica fornita dal ristoratore',
    mappingType: 'foto_specifica_fornitore',
    filename: desktopFilename,
    sourceFilename: row.filename,
    sourceChecksum: sha256(row.source),
    needsSupplierConfirmation: false,
    requiresSupplierPhoto: false,
    auditPublishable: true,
    responsive: {mobile:publicMobile, desktop:publicDesktop}
  };
  manifest.push({
    productId:product.id,
    productName:product.name,
    category:product.cat,
    sourceFilename:row.filename,
    sourceChecksum:product.imageMeta.sourceChecksum,
    desktop:publicDesktop,
    mobile:publicMobile,
    desktopBytes:statSync(desktopTarget).size,
    mobileBytes:statSync(mobileTarget).size,
    colorConversion:/_CMYK/i.test(row.filename) ? 'CMYK_to_sRGB' : 'source_RGB'
  });
}

const productsById = new Map(menu.products.map(product => [product.id, product]));
const fullMap = existingMap.map(row => {
  const product = productsById.get(row.id);
  if (!product || product.imageMeta?.source !== 'fornitore-dos-20260806') return row;
  return {
    ...row,
    image:product.img,
    specific:true,
    auditPublishable:true,
    sourceAsset:product.imageMeta.filename
  };
});
writeFileSync(menuPath, `${JSON.stringify(menu, null, 2)}\n`);
writeFileSync(manifestPath, `${JSON.stringify({importBatch:'2026-08-06', sourcePackage:basename(sourceRoot), count:manifest.length, images:manifest}, null, 2)}\n`);
writeFileSync(mapPath, `${JSON.stringify(fullMap, null, 2)}\n`);

const cards = manifest.map(item => `<article><picture><source media="(max-width:640px)" srcset="../${item.mobile.replace(/^\.\.\//, '')}"><img src="../${item.desktop.replace(/^\.\.\//, '')}" alt="${html(item.productName)}" loading="lazy"></picture><div><span>${html(item.category)}</span><h2>${html(item.productName)}</h2><small>${Math.round(item.desktopBytes / 1024)} KB · ${html(item.colorConversion)}</small></div></article>`).join('');
writeFileSync(galleryPath, `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Audit immagini Pagnottella</title><style>body{margin:0;background:#f3efe7;color:#20251f;font-family:Georgia,serif}main{max-width:1240px;margin:auto;padding:40px 20px}h1{font-size:clamp(32px,5vw,64px);margin:0 0 8px}.intro{color:#62675f;margin:0 0 32px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:18px}article{overflow:hidden;border:1px solid #ded6c8;border-radius:22px;background:#fff;box-shadow:0 12px 30px #28302312}img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover}article div{padding:16px}span{color:#b15e35;font:700 11px sans-serif;text-transform:uppercase;letter-spacing:.12em}h2{margin:7px 0;font-size:22px}small{color:#74776f;font-family:sans-serif}</style></head><body><main><h1>Nuove foto Pagnottella</h1><p class="intro">${manifest.length} associazioni specifiche, ordinate per categoria e prodotto.</p><section class="grid">${cards}</section></main></body></html>`);

const totalDesktop = manifest.reduce((sum, item) => sum + item.desktopBytes, 0);
const totalMobile = manifest.reduce((sum, item) => sum + item.mobileBytes, 0);
console.log(`Import completato: ${manifest.length} prodotti, desktop ${(totalDesktop/1048576).toFixed(1)} MB, mobile ${(totalMobile/1048576).toFixed(1)} MB.`);
