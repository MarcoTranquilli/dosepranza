#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[preflight] checking required files..."
test -f index.html
test -f app.v20260210.js
test -f app.v20260325.js
test -f styles.css
test -f netlify.toml
test -f netlify-preauth-reset.js
test -f netlify-staff-auth-guard.js

echo "[preflight] syntax check js..."
node --check app.v20260210.js
node --check app.js
node --check app.v20260325.js
node --check netlify-preauth-reset.js
node --check netlify-staff-auth-guard.js

echo "[preflight] checking Russo-only architecture..."
bash scripts/verify_russo_only.sh .

echo "[preflight] checking Netlify CSP allows Google popup scripts..."
grep -q "https://apis.google.com" netlify.toml
grep -q "https://accounts.google.com" netlify.toml

echo "[preflight] ready for Netlify deploy."
