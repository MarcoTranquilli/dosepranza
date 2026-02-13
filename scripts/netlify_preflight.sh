#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[preflight] checking required files..."
test -f index.html
test -f app.v20260210.js
test -f styles.css
test -f netlify.toml

echo "[preflight] syntax check js..."
node --check app.v20260210.js
node --check app.js

echo "[preflight] checking Netlify CSP allows Google popup scripts..."
grep -q "https://apis.google.com" netlify.toml
grep -q "https://accounts.google.com" netlify.toml

echo "[preflight] ready for Netlify deploy."
