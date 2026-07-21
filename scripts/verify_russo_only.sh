#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"

for path in \
  "$ROOT/pagnottella" \
  "$ROOT/pagnottella-preview" \
  "$ROOT/scelta-fornitore" \
  "$ROOT/supplier-access.js" \
  "$ROOT/hub-auth.js" \
  "$ROOT/fornitori.html"; do
  if [[ -e "$path" ]]; then
    echo "[russo-only] forbidden multi-supplier path: $path" >&2
    exit 1
  fi
done

runtime_files=()
while IFS= read -r file; do
  runtime_files+=("$file")
done < <(find "$ROOT" -maxdepth 1 -type f \
  \( -name 'index.html' -o -name 'app.js' -o -name 'app.v*.js' -o -name 'netlify-*.js' \) \
  -print)

if (( ${#runtime_files[@]} == 0 )); then
  echo "[russo-only] no runtime files found under $ROOT" >&2
  exit 1
fi

if grep -Eni 'pagnottella|multi-fornitore|scelta fornitore|supplier-access|hub-auth' "${runtime_files[@]}"; then
  echo "[russo-only] forbidden multi-supplier reference found" >&2
  exit 1
fi

if [[ "$ROOT" != "." ]]; then
  test -s "$ROOT/russo/index.html"
  grep -Eq '<base href="\.\./">' "$ROOT/russo/index.html"
fi

echo "[russo-only] verified: $ROOT"
