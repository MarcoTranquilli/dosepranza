# DOSepranza Frige MVP

[![UAT Playwright](https://github.com/MarcoTranquilli/dosepranza/actions/workflows/uat.yml/badge.svg)](https://github.com/MarcoTranquilli/dosepranza/actions/workflows/uat.yml)

## Produzione attiva

- URL live: `https://marcotranquilli.github.io/dosepranza/`
- Deploy: GitHub Pages (branch `main`)
- Nota: le sezioni Netlify sotto sono legacy e non usate nel flusso corrente.

## Rilascio rapido su Netlify

1. Esegui preflight locale:
```bash
./scripts/netlify_preflight.sh
```
2. Login Netlify CLI:
```bash
npx netlify login
```
3. Collega o crea il sito:
```bash
npx netlify link
```
4. Deploy preview:
```bash
npx netlify deploy --dir .
```
5. Deploy produzione:
```bash
npx netlify deploy --dir . --prod
```

Configurazione pronta in:
- `/Users/marcotranquilli/Documents/GitHub/dosepranza/netlify.toml`

## UAT (Playwright)

```bash
npm install
npx playwright install
npm run test:uat
```

Report HTML:
- `playwright-report/index.html`

Report PDF:
- `playwright-report/uat-report.pdf`

## PDF pubblico su Netlify (legacy)

Se abiliti `UAT_IN_NETLIFY=1` nelle environment variables del sito, il build Netlify genererà e pubblicherà il report PDF qui:

- `/uat-report.pdf`
- `/reports/uat-report.pdf`
- `/reports` (pagina indice)

> Nota sicurezza: per rendere i report accessibili solo internamente, abilita **Password Protection** su Netlify (richiede piano a pagamento) oppure usa **Netlify Identity** con ruoli (già predisposto).

## Accesso protetto con Netlify Identity (legacy)

1. Netlify → **Site configuration → Identity** → **Enable Identity**  
2. Invita gli utenti e assegna il ruolo `reports` o `admin`  
3. Accesso protetto:
   - `/reports/*` e `/uat-report.pdf` accessibili solo ai ruoli `reports` o `admin`
   - chi non è autenticato viene reindirizzato a `/login`

### Pagina di login
`/login` usa Netlify Identity per l’accesso.

### Storico report
Lo storico viene generato in `reports/history/` ad ogni build.  
Nota: lo storico è persistente tramite **Netlify Blobs** (chiave `uat-reports`).  
Gli endpoint usati sono:
- `/.netlify/functions/reports` (lista JSON)
- `/.netlify/functions/report?key=reports/latest.pdf` (download)

## Email automatica post-UAT (opzionale)

Per inviare email automatiche agli admin dopo la generazione del report:

1. Imposta le variabili ambiente su Netlify:
   - `SENDGRID_API_KEY`
   - `REPORT_EMAIL_TO` (es. admin@azienda.com)
   - `REPORT_EMAIL_FROM` (es. noreply@azienda.com)
   - `REPORT_BASE_URL` (es. https://app-dosepranza.netlify.app)

2. Il build invierà un’email con link a `/reports` e al PDF.

## Slack alert (opzionale)

Se vuoi ricevere un alert Slack in caso di fallimento UAT:

- `SLACK_WEBHOOK_URL`
- `SLACK_ESCALATION_WEBHOOK_URL` (solo high severity)
- `REPORT_BASE_URL`

L’alert viene inviato solo se `failed > 0`.

### Upload PDF su Slack (opzionale)

Per caricare il PDF direttamente su Slack:

- `SLACK_BOT_TOKEN`
- `SLACK_CHANNEL_ID`

Per inviare sempre il PDF anche su successi:
- `SLACK_FILE_ALWAYS=1`

## Teams alert (opzionale)

Se vuoi ricevere un alert Teams in caso di fallimento UAT:

- `TEAMS_WEBHOOK_URL`
- `REPORT_BASE_URL`

## Failures history (opzionale)

In caso di fallimenti, il build salva un file JSON in:

`reports/failures/failures-YYYY-MM-DD.json`

## Flaky tests (opzionale)

I flaky vengono salvati in:
`reports/flaky/latest.json` e `reports/flaky/flaky-YYYY-MM-DD.json`.

## Weekly aggregate

Il build genera `reports/weekly.json` con i conteggi settimanali.

## Export audit su S3 (opzionale)

Se vuoi salvare l’audit anche su S3, imposta:

- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AUDIT_S3_BUCKET`
- `AUDIT_S3_PREFIX` (opzionale)
- `AUDIT_S3_KMS_KEY` (opzionale, per cifratura KMS)
- `REPORT_BASE_URL`

Il build scarica l’audit e lo carica in S3 come JSON.

## CI + Netlify (legacy)

- GitHub Actions esegue la UAT su PR e su `main`.
- Netlify deploy può essere triggerato via **Build Hook** (se fornito).

Imposta il secret GitHub `NETLIFY_BUILD_HOOK` con l’URL del build hook Netlify.

## Regole Firestore raccomandate

Usa il file:
- `/Users/marcotranquilli/Documents/GitHub/dosepranza/FIRESTORE_RULES_ENTERPRISE.txt`

Punti chiave:
- utenti standard: possono leggere solo i propri ordini (`uid`).
- staff (`admin`, `ristoratore`, `facility`): può leggere/gestire viste operative.
- collezioni custom (`custom_creations`, `menu_audit`, `orders_audit`) incluse.
