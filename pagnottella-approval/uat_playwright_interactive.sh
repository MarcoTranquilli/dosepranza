#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8081}"
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"
SESSION="${PLAYWRIGHT_CLI_SESSION:-dosepranza-uat}"

if ! command -v npx >/dev/null 2>&1; then
  echo "npx non trovato. Installa Node.js/npm prima di continuare." >&2
  exit 1
fi

if [ ! -x "$PWCLI" ]; then
  echo "Wrapper Playwright CLI non trovato: $PWCLI" >&2
  exit 1
fi

echo "Avvio UAT semi-automatica su: $BASE_URL"

read -r -p "Nome utente: " USER_NAME
read -r -p "Email utente: " USER_EMAIL

"$PWCLI" --session "$SESSION" open "$BASE_URL"

# Login
"$PWCLI" --session "$SESSION" run-code "await page.fill('#user-name-input', '${USER_NAME//"/\"}');"
"$PWCLI" --session "$SESSION" run-code "await page.fill('#user-email-input', '${USER_EMAIL//"/\"}');"
"$PWCLI" --session "$SESSION" run-code "await page.click('[data-action=save-user]');"

# Menù: aggiungi il primo prodotto
"$PWCLI" --session "$SESSION" run-code "await page.click('[data-action=add-std]');"

# Carrello: conferma ordine
"$PWCLI" --session "$SESSION" run-code "await page.click('#btn-cart');"
"$PWCLI" --session "$SESSION" run-code "const btn = await page.$('[data-action=send-order]'); if(btn) await btn.click();"

# Frige: compra primo prodotto disponibile
"$PWCLI" --session "$SESSION" run-code "await page.click('#btn-frige');"
"$PWCLI" --session "$SESSION" run-code "const buy = await page.$('[data-action=frige-open-modal]'); if(buy) await buy.click();"
"$PWCLI" --session "$SESSION" run-code "const chk = await page.$('#frige-paid-check'); if(chk) await chk.check();"
"$PWCLI" --session "$SESSION" run-code "const confirm = await page.$('[data-action=confirm-frige]'); if(confirm) await confirm.click();"

"$PWCLI" --session "$SESSION" screenshot

echo "UAT base completata. Screenshot salvato."
