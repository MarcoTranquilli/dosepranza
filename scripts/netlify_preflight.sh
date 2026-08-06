#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[preflight] checking required files..."
test -f index.html
test -f hub-auth.js
test -f supplier-access.js
test -f app.v20260210.js
test -f app.v20260325.js
test -f styles.css
test -f netlify.toml
test -f pagnottella/index.html
test -f pagnottella/pagnottella.js
test -f assets/pagnottella/data/menu.json
test -f FIRESTORE_RULES_ENTERPRISE.txt
test -f firestore.indexes.json

echo "[preflight] syntax check js..."
node --check app.v20260210.js
node --check app.js
node --check app.v20260325.js
node --check hub-auth.js
node --check supplier-access.js
node --check pagnottella/pagnottella.js

echo "[preflight] checking multi-supplier production assets..."
grep -q "supplier-access.js" index.html
grep -q "hub-auth.js" index.html
grep -q "supplier-access.js" pagnottella/index.html
node -e "const menu=require('./assets/pagnottella/data/menu.json'); const count=menu.products.filter(p=>p.imageMeta?.specific).length; if(count!==10) process.exit(1)"

echo "[preflight] checking Netlify CSP allows Google popup scripts..."
grep -q "https://apis.google.com" netlify.toml
grep -q "https://accounts.google.com" netlify.toml

echo "[preflight] ready for Netlify deploy."
