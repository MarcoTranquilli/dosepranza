#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_ROOT="${ROOT_DIR}/dist-production"
DIST_DIR="${DIST_ROOT}/pagnottella-gourmet"

echo "--- Build Pagnottella production ---"
rm -rf "${DIST_ROOT}"
mkdir -p "${DIST_DIR}/assets/branding" "${DIST_DIR}/assets/pagnottella/images" "${DIST_DIR}/assets/pagnottella/payment"

cp "${ROOT_DIR}/pagnottella-gourmet/index.html" "${DIST_DIR}/"
cp "${ROOT_DIR}/pagnottella-gourmet/production.css" "${DIST_DIR}/"
cp "${ROOT_DIR}/pagnottella-gourmet/production-polish.js" "${DIST_DIR}/"
cp "${ROOT_DIR}/pagnottella-gourmet/production-admin.js" "${DIST_DIR}/"
cp "${ROOT_DIR}/pagnottella-gourmet/pagnottella.js" "${DIST_DIR}/"
cp "${ROOT_DIR}/pagnottella-gourmet/supplier-access.js" "${DIST_DIR}/"
cp "${ROOT_DIR}/pagnottella/pagnottella.css" "${DIST_DIR}/"
cp "${ROOT_DIR}/favicondosepranza.png" "${DIST_DIR}/"
cp -R "${ROOT_DIR}/assets/branding/." "${DIST_DIR}/assets/branding/"
cp -R "${ROOT_DIR}/assets/pagnottella/images/." "${DIST_DIR}/assets/pagnottella/images/"
cp -R "${ROOT_DIR}/assets/pagnottella/payment/." "${DIST_DIR}/assets/pagnottella/payment/"

node "${ROOT_DIR}/scripts/build_pagnottella_production.mjs"
touch "${DIST_ROOT}/.nojekyll"

test -s "${DIST_DIR}/index.html"
test -s "${DIST_DIR}/production-admin.js"
test -s "${DIST_DIR}/assets/pagnottella/data/menu.json"
test -s "${DIST_DIR}/assets/pagnottella/payment/satispay-qr-pagnottella.png"
echo "--- Build completata: ${DIST_DIR} ---"
