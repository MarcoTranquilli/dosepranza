#!/bin/bash
set -euo pipefail

echo "--- Inizio Build DOSepranza ---"

DIST_DIR="dist"

# 1. Crea una cartella pulita per il deploy
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

# 2. Copia i file fondamentali nella cartella dist
cp index.html "$DIST_DIR/"
cp app.js "$DIST_DIR/" 2>/dev/null || true
cp app.v20260210.js "$DIST_DIR/" 2>/dev/null || true
cp app.v20260325.js "$DIST_DIR/" 2>/dev/null || cp app.js "$DIST_DIR/index.js"
cp styles.css "$DIST_DIR/" 2>/dev/null || echo "No CSS file found"
cp tailwind-config.js "$DIST_DIR/" 2>/dev/null || echo "No Tailwind config found"
cp sw-killer.js "$DIST_DIR/" 2>/dev/null || echo "No service worker helper found"
cp favicondosepranza.png "$DIST_DIR/" 2>/dev/null || echo "No favicon found"
cp -R login "$DIST_DIR/" 2>/dev/null || echo "No login folder"
cp -R reports "$DIST_DIR/" 2>/dev/null || echo "No reports folder"

echo "--- Build completata con successo nella cartella /$DIST_DIR ---"
