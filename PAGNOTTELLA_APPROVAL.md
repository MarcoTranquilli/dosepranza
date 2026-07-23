# Anteprima approvazione La Pagnottella Gourmet

Questo branch contiene il pacchetto autonomo usato per la revisione del responsabile
di La Pagnottella Gourmet. Non modifica la versione Russo in produzione e non usa
Netlify.

## Contenuti verificabili

- catalogo completo Panini e Insalate;
- immagini e loghi locali;
- sconto del 20% applicato automaticamente;
- ordine e pagamento entro le 12:00, consegna entro le 13:00;
- Contanti, POS, Bonifico bancario e Satispay;
- PayPal e Nexi visibili ma non selezionabili fino a settembre;
- QR Satispay e coordinate bancarie;
- carrello e riepilogo WhatsApp per il ristoratore;
- salvataggio locale isolato degli ordini di prova.

Gli ordini effettuati nell'anteprima sponsor non vengono scritti nel database
Firebase operativo.

## Verifica locale

```bash
npm ci
npm run build:approval
python3 -m http.server 8082 --bind 127.0.0.1 --directory dist-approval
```

Aprire:

```text
http://127.0.0.1:8082/
```

## Test

```bash
npm run test:approval
npx playwright test --project=preview
```

## Pubblicazione

Avviare manualmente il workflow GitHub Actions `Pagnottella Sponsor Approval`.
Il workflow ricostruisce il pacchetto, esegue gli UAT e aggiorna soltanto:

```text
gh-pages/pagnottella-approval/
```

La directory principale e il percorso `russo/` non vengono modificati.
