# UAT Playwright CLI (Guidata)

> Nota: questa guida usa `playwright-cli` con snapshot e ref IDs (`e1`, `e2`, ...).
> Dopo ogni `snapshot` scegli l'ID corretto dall'elenco stampato dal tool.

## Setup
```bash
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"

# Facoltativo: sessione dedicata
export PLAYWRIGHT_CLI_SESSION=dosepranza-uat

# Apri la web app (locale o Netlify)
"$PWCLI" open http://127.0.0.1:8081
"$PWCLI" snapshot
```

## A. Utente standard (collega)
1) **Login**
- Trova `Nome e Cognome` e `Email` e fai fill
```bash
"$PWCLI" fill eX "Mario Rossi"
"$PWCLI" fill eY "mario.rossi@dos.design"
"$PWCLI" click eZ   # Entra nell'App
"$PWCLI" snapshot
```

2) **Menù + filtri**
- Cambia categoria e dieta
```bash
"$PWCLI" click eX   # Select categorie
"$PWCLI" press ArrowDown
"$PWCLI" press Enter
"$PWCLI" click eY   # Select dieta
"$PWCLI" press ArrowDown
"$PWCLI" press Enter
"$PWCLI" snapshot
```

3) **Aggiungi prodotto al carrello**
```bash
"$PWCLI" click eX   # bottone + su un prodotto
"$PWCLI" snapshot
```

4) **Carrello e conferma ordine**
```bash
"$PWCLI" click eX   # Tab Ordine
"$PWCLI" snapshot
"$PWCLI" click eY   # Conferma ordine
"$PWCLI" snapshot
```

5) **Frige (WIP non visibile per standard)**
```bash
"$PWCLI" snapshot   # Verifica assenza tab Frige per utente standard
```

6) **Stato ordine personale**
```bash
"$PWCLI" click eX   # Tab Ordine
"$PWCLI" snapshot
```

## B. Facility manager
1) Login con `beatrice.binini@dos.design` o `monica.porta@dos.design`.
2) Frige: usa `+1 / -1`, `Richiedi rifornimento`.
3) Verifica che **History** e **Analisi** non siano accessibili.

## C. Ristoratore
1) Login con `lorenzo.russo@alimentarirusso`.
2) Frige: aggiungi prodotto, cambia prezzo, rimuovi.
3) Riconciliazione: lista pagamenti Frige + Ordini.

## D. Admin
1) Login con `marco.tranquilli@dos.design`.
2) Export CSV e PDF in Analisi.
3) Zoom e toggle giornaliero/settimanale nei grafici.

## Screenshot e report
```bash
"$PWCLI" screenshot
"$PWCLI" pdf
```

## Reset sessione
```bash
"$PWCLI" close
```
