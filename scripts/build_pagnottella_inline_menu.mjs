import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sourcePath = resolve(root, 'assets/pagnottella/data/menu.json');
const targetPath = resolve(root, 'assets/pagnottella/data/menu.inline.js');

const json = readFileSync(sourcePath, 'utf8');
writeFileSync(targetPath, `window.__PAGNOTTELLA_MENU__ = ${json};\n`);

console.log(`Generated ${targetPath}`);
