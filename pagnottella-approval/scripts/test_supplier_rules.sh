#!/usr/bin/env bash
set -euo pipefail

if ! java -version >/dev/null 2>&1; then
  for java_home in /opt/homebrew/opt/openjdk@21 /opt/homebrew/opt/openjdk@17 /usr/local/opt/openjdk@21 /usr/local/opt/openjdk@17; do
    if [[ -x "$java_home/bin/java" ]]; then
      export PATH="$java_home/bin:$PATH"
      break
    fi
  done
fi

java -version >/dev/null 2>&1 || {
  echo "Java 17+ is required by the Firestore emulator." >&2
  exit 1
}

firebase emulators:exec \
  --only firestore \
  --project demo-dosepranza-supplier-rules \
  --config firebase.pagnottella-validation.json \
  "node tests/firestore.supplier-rules.mjs"
