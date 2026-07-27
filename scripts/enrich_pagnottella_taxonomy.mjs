import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const menuPath = resolve(root, 'assets/pagnottella/data/menu.json');
const menu = JSON.parse(readFileSync(menuPath, 'utf8'));

const clusters = [
  { id:'all', label:'Tutto' },
  { id:'panini', label:'Panini' },
  { id:'insalate', label:'Insalate' },
  { id:'speciali', label:'Specialità' },
  { id:'bevande', label:'Bevande' },
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
  if (['panini', 'insalate', 'speciali', 'bevande', 'dolci'].includes(product.categoryGroup)) {
    return product.categoryGroup;
  }
  if (product.cat.startsWith('panini-')) return 'panini';
  if (product.cat.startsWith('insalate-')) return 'insalate';
  if (product.cat === 'speciali') return 'speciali';
  if (product.cat === 'succhi-freschi') return 'bevande';
  if (product.cat === 'bevande-dolci') {
    return product.tags?.includes('Dessert') ? 'dolci' : 'bevande';
  }
  throw new Error(`Categoria non mappata per ${product.id}: ${product.cat}`);
}

function dietType(product) {
  if (['onnivora', 'vegetariana', 'vegana', 'pescetariana', 'tutte'].includes(product.dietType)) {
    return product.dietType;
  }
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
const heroByGroup = {
  all: menu.cats.find(category => category.id === 'all')?.hero,
  panini: menu.cats.find(category => category.id.startsWith('panini-'))?.hero,
  insalate: menu.cats.find(category => category.id.startsWith('insalate-'))?.hero,
  speciali: menu.cats.find(category => category.id === 'speciali')?.hero,
  bevande: menu.cats.find(category => ['bevande-dolci', 'bevande'].includes(category.id))?.hero,
  dolci: menu.cats.find(category => ['bevande-dolci', 'dolci'].includes(category.id))?.hero
};

menu.products = menu.products.map(product => {
  const group = categoryGroup(product);
  return {
    ...product,
    cat: group,
    categoryGroup: group,
    dietType: dietType(product),
    supportsExtras: group === 'panini' || group === 'insalate',
    needsDietReview: needsDietReview(product)
  };
});
menu.cats = clusters.map(category => ({ ...category, hero:heroByGroup[category.id] || heroByGroup.all }));

writeFileSync(menuPath, `${JSON.stringify(menu, null, 2)}\n`);
console.log(`Enriched ${menu.products.length} products with categoryGroup and dietType.`);
