# Runbook di ripristino DOSepranza Russo-only

## Versione di riferimento

- Base stabile recuperata: commit `0879606` su `origin/main`.
- Branch di stabilizzazione: `fix/russo-only-stabilization-clean`.
- Obiettivo: applicazione Alimentari Russo senza hub, selezione fornitore o asset Pagnottella.

Non usare `git reset --hard` sulla copia di lavoro. Per un ripristino isolato:

```bash
git fetch origin --prune
git worktree add ../dosepranza-russo-recovery -b recovery/russo-only 0879606
cd ../dosepranza-russo-recovery
npm ci
bash scripts/netlify_publish_pdf.sh
BASE_URL=http://127.0.0.1:8081 npm run test:uat
```

Avviare prima un server locale per l'ultimo comando:

```bash
python3 -m http.server 8081 --directory dist
```

## Verifica dell'artefatto

La build valida e copia il sito in `dist/`:

```bash
bash scripts/netlify_preflight.sh
bash scripts/netlify_publish_pdf.sh
bash scripts/verify_russo_only.sh dist
cmp index.html dist/index.html
cmp app.v20260325.js dist/app.v20260325.js
```

Il controllo deve terminare senza errori e stampare `[russo-only] verified: dist`.

## GitHub Pages prima di Netlify

Il workflow manuale `GitHub Pages Russo-only` esegue build, UAT e controllo architetturale prima di sostituire `gh-pages` con il solo contenuto di `dist/`.

Prima della prima pubblicazione conservare il vecchio branch:

```bash
git fetch origin gh-pages
git push origin origin/gh-pages:refs/heads/archive/gh-pages-multisupplier-20260721
```

Poi avviare il workflow dalla branch di stabilizzazione:

```bash
gh workflow run pages-russo-only.yml --ref fix/russo-only-stabilization-clean
gh run watch --exit-status
```

Verificare `https://marcotranquilli.github.io/dosepranza/` in finestra anonima. Deve aprirsi direttamente il menu Russo e non una pagina di scelta fornitore.

## Netlify

Configurazione attesa:

- production branch: `main`;
- build command: `bash scripts/netlify_publish_pdf.sh`;
- publish directory: `dist`;
- functions directory: `netlify/functions`.

Controlli prima della produzione:

1. Il deploy deve indicare il commit Russo-only approvato.
2. Il log deve contenere `[russo-only] verified: dist`.
3. Il file pubblicato `index.html` deve caricare `app.v20260325.js` e i due guard di autenticazione.
4. Nessun deploy di produzione va avviato prima del test GitHub Pages e dell'approvazione.

## Firebase

Questa stabilizzazione non cambia progetto, collezioni o regole Firebase. Configurazione client attesa:

- project ID: `app-ordini-pranzo-alimentari`;
- auth domain: `app-ordini-pranzo-alimentari.firebaseapp.com`;
- collezione ordini: `orders`;
- collezioni operative: `orders_audit`, `menu_products`, `menu_audit`, `frige_products`, `frige_purchases`, `frige_refills`.

Verificare dalla console Firebase:

1. Authentication > Sign-in method: Google e Anonymous abilitati.
2. Authentication > Settings > Authorized domains: presenti `app-dosepranza.netlify.app` e `marcotranquilli.github.io`.
3. Firestore: database del progetto corretto e localita `eur3`.
4. Gli account staff autenticati via Google corrispondono alle email previste nell'app.
5. Le regole distribuite consentono lettura ordini ai ruoli autorizzati e creazione agli utenti autenticati secondo il modello Russo esistente.

Non modificare chiavi, project ID o regole durante un rollback applicativo senza una migrazione separata e verificata.

## Checklist finale

- [ ] `npm ci` completato.
- [ ] preflight e build verdi.
- [ ] UAT Playwright tutti verdi.
- [ ] `verify_russo_only.sh` verde su sorgente e `dist`.
- [ ] branch storico `gh-pages` salvato sotto `archive/`.
- [ ] GitHub Pages apre direttamente Alimentari Russo.
- [ ] nessun link o file runtime relativo alla scelta del fornitore.
- [ ] login utente, ruoli staff, menu, ordine, riepilogo, Fridge e analisi verificati.
- [ ] domini autorizzati e provider Firebase verificati.
- [ ] Netlify punta al commit approvato e pubblica `dist`.
- [ ] repository pulito dopo commit e push.
