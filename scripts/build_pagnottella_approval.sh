#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="${ROOT_DIR}/dist-approval"

echo "--- Build Pagnottella approval ---"
rm -rf "${DIST_DIR}"
mkdir -p \
  "${DIST_DIR}/pagnottella-preview" \
  "${DIST_DIR}/pagnottella" \
  "${DIST_DIR}/assets/branding" \
  "${DIST_DIR}/assets/pagnottella/data" \
  "${DIST_DIR}/assets/pagnottella/images" \
  "${DIST_DIR}/assets/pagnottella/payment"

cp "${ROOT_DIR}/pagnottella-preview/index.html" "${DIST_DIR}/pagnottella-preview/"
cp "${ROOT_DIR}/pagnottella-preview/preview-fixes.css" "${DIST_DIR}/pagnottella-preview/"
cp "${ROOT_DIR}/pagnottella-preview/sponsor-polish.js" "${DIST_DIR}/pagnottella-preview/"
cp "${ROOT_DIR}/pagnottella-preview/approval-admin.js" "${DIST_DIR}/pagnottella-preview/"
cp "${ROOT_DIR}/pagnottella/pagnottella.css" "${DIST_DIR}/pagnottella/"
cp "${ROOT_DIR}/pagnottella/pagnottella.js" "${DIST_DIR}/pagnottella/"
cp "${ROOT_DIR}/supplier-access.js" "${DIST_DIR}/"
cp "${ROOT_DIR}/pages-admin-unlock.js" "${DIST_DIR}/"
cp "${ROOT_DIR}/favicondosepranza.png" "${DIST_DIR}/"
cp -R "${ROOT_DIR}/assets/branding/." "${DIST_DIR}/assets/branding/"
cp "${ROOT_DIR}/assets/pagnottella/data/menu.json" "${DIST_DIR}/assets/pagnottella/data/"
cp "${ROOT_DIR}/assets/pagnottella/data/menu.inline.js" "${DIST_DIR}/assets/pagnottella/data/"
cp -R "${ROOT_DIR}/assets/pagnottella/images/." "${DIST_DIR}/assets/pagnottella/images/"
cp -R "${ROOT_DIR}/assets/pagnottella/payment/." "${DIST_DIR}/assets/pagnottella/payment/"

cat > "${DIST_DIR}/index.html" <<'EOF'
<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>DOSepranza · La Pagnottella Gourmet</title>
  <link rel="icon" href="./favicondosepranza.png">
  <meta http-equiv="refresh" content="0; url=./pagnottella-preview/?preview=admin&amp;review=sponsor">
  <script>location.replace('./pagnottella-preview/?preview=admin&review=sponsor');</script>
</head>
<body>
  <p><a href="./pagnottella-preview/?preview=admin&amp;review=sponsor">Apri l'anteprima La Pagnottella Gourmet</a></p>
</body>
</html>
EOF

touch "${DIST_DIR}/.nojekyll"

test -s "${DIST_DIR}/index.html"
test -s "${DIST_DIR}/pagnottella-preview/index.html"
test -s "${DIST_DIR}/pagnottella-preview/approval-admin.js"
test -s "${DIST_DIR}/assets/pagnottella/data/menu.json"
test -s "${DIST_DIR}/assets/pagnottella/payment/satispay-qr-pagnottella.png"

echo "--- Build completata: ${DIST_DIR} ---"
