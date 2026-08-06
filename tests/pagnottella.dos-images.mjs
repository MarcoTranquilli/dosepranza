import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const menu = JSON.parse(fs.readFileSync(path.join(root, 'assets/pagnottella/data/menu.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/pagnottella/data/dos-supplier-image-manifest.json'), 'utf8'));
const imported = menu.products.filter(product => product.imageMeta?.source === 'fornitore-dos-20260806');

assert.equal(manifest.count, 37);
assert.equal(imported.length, 37);
assert.equal(new Set(manifest.images.map(item => item.productId)).size, 37);
assert.equal(imported.filter(product => product.cat === 'panini').length, 19);
assert.equal(imported.filter(product => product.cat === 'insalate').length, 18);

for (const name of ['Caprese', 'San Jose']) {
  const matches = imported.filter(product => product.name === name);
  assert.equal(matches.length, 2, `${name}: associazioni`);
  assert.deepEqual(new Set(matches.map(product => product.cat)), new Set(['panini', 'insalate']));
  assert.equal(new Set(matches.map(product => product.img)).size, 2, `${name}: asset distinti`);
}

for (const product of imported) {
  assert.equal(product.imageMeta.specific, true);
  assert.equal(product.imageMeta.confidence, 'alta');
  assert.equal(product.imageMeta.mappingType, 'foto_specifica_fornitore');
  for (const variant of ['desktop', 'mobile']) {
    const relative = product.imageMeta.responsive[variant].replace(/^\.\.\//, '');
    const file = path.join(root, relative);
    assert.ok(fs.existsSync(file), `${product.name}: ${variant} mancante`);
    assert.equal(fs.readFileSync(file).subarray(0, 4).toString('ascii'), 'RIFF');
    assert.ok(fs.statSync(file).size < 350 * 1024, `${product.name}: ${variant} supera 350 KB`);
  }
}

const burrata = manifest.images.find(item => item.productName === 'Burrata' && item.category === 'insalate');
assert.deepEqual(
  {sourceFilename:burrata?.sourceFilename, colorConversion:burrata?.colorConversion},
  {sourceFilename:'burrata_CMYK.jpg', colorConversion:'CMYK_to_sRGB'}
);
console.log('pagnottella-dos-images: 37/37 passed');
