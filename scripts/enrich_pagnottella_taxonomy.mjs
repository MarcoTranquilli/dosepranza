import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const menuPath = resolve(root, 'assets/pagnottella/data/menu.json');
const menu = JSON.parse(readFileSync(menuPath, 'utf8'));

const clusters = [
  { id:'all', label:'Tutto' },
  { id:'panini', label:'Panini' },
  { id:'insalate', label:'Insalate' },
  { id:'speciali', label:'Speciali del punto vendita' },
  { id:'bevande', label:'Bevande' },
  { id:'succhi', label:'Succhi freschi' },
  { id:'dolci', label:'Dolci' }
];

const diets = [
  { id:'all', label:'Tutte' },
  { id:'onnivora', label:'Onnivora' },
  { id:'vegetariana', label:'Vegetariana' },
  { id:'vegana', label:'Vegana' },
  { id:'pescetariana', label:'Pescetariana' }
];

function categoryGroup(product) {
  if (product.cat.startsWith('panini-')) return 'panini';
  if (product.cat.startsWith('insalate-')) return 'insalate';
  if (product.cat === 'speciali') return 'speciali';
  if (product.cat === 'succhi-freschi') return 'succhi';
  if (product.cat === 'bevande-dolci') {
    return product.tags?.includes('Dessert') ? 'dolci' : 'bevande';
  }
  throw new Error(`Categoria non mappata per ${product.id}: ${product.cat}`);
}

function dietType(product) {
  if (product.cat.endsWith('-carne') || product.cat === 'speciali') return 'onnivora';
  if (product.cat.endsWith('-pesce')) return 'pescetariana';
  if (product.cat === 'succhi-freschi') return 'tutte';
  if (product.cat === 'bevande-dolci') {
    if (product.name === 'Macedonia') return 'vegana';
    if (product.tags?.includes('Dessert')) return 'vegetariana';
    return 'tutte';
  }
  if (product.cat.endsWith('-veg')) {
    if (product.id === 'insalate-veg-vegetariana-5') return 'vegana';
    return 'vegetariana';
  }
  throw new Error(`Regime non mappato per ${product.id}: ${product.cat}`);
}

function needsDietReview(product) {
  // Pesto e salse possono contenere latticini/uova: la classificazione resta prudente.
  return [
    'panini-veg-ortolino-3',
    'panini-veg-tricolore-5',
    'insalate-veg-greca-2',
    'insalate-veg-ortolana-3'
  ].includes(product.id);
}

menu.filterTaxonomy = { clusters, diets };
menu.products = menu.products.map(product => ({
  ...product,
  categoryGroup: categoryGroup(product),
  dietType: dietType(product),
  needsDietReview: needsDietReview(product)
}));

writeFileSync(menuPath, `${JSON.stringify(menu, null, 2)}\n`);
console.log(`Enriched ${menu.products.length} products with categoryGroup and dietType.`);
