import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'assets/pagnottella/data/menu.json');
const targetDir = path.join(root, 'dist-production/pagnottella-gourmet/assets/pagnottella/data');
const menu = JSON.parse(fs.readFileSync(source, 'utf8'));
const localizeAssets = value => {
  if (Array.isArray(value)) return value.map(localizeAssets);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, localizeAssets(item)]));
  }
  return typeof value === 'string' ? value.replace(/^\.\.\/assets\//, './assets/') : value;
};
const restrictedPattern = /\b(birr(?:a|e)|alcol|alcolic|beer)\b/i;

menu.products = menu.products.map(product => {
  const restricted = restrictedPattern.test(`${product.name || ''} ${product.desc || ''} ${(product.tags || []).join(' ')}`);
  return {
    ...product,
    img: String(product.img || '').replace(/^\.\.\/assets\//, './assets/'),
    ...(restricted ? {
      isActive: false,
      orderable: false,
      disabledReason: 'Prodotto non ordinabile tramite DOSepranza'
    } : {})
  };
});

Object.assign(menu, localizeAssets(menu));

fs.mkdirSync(targetDir, { recursive: true });
fs.writeFileSync(path.join(targetDir, 'menu.json'), `${JSON.stringify(menu, null, 2)}\n`);
fs.writeFileSync(path.join(targetDir, 'menu.inline.js'), `window.__PAGNOTTELLA_MENU__ = ${JSON.stringify(menu, null, 2)};\n`);

const restricted = menu.products.filter(product => product.orderable === false);
if (!restricted.length) throw new Error('Nessun prodotto age-restricted disattivato.');
console.log(`Menu production: ${menu.products.length} prodotti, ${restricted.length} non ordinabili.`);
