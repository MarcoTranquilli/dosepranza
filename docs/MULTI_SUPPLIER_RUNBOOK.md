# DOSepranza 2.0 - Runbook multi-fornitore

## Comportamento atteso

- L'accesso online usa Firebase Google Auth.
- `marco.tranquilli@dos.design` e' l'amministratore della suite.
- L'amministratore vede sempre Alimentari Russo e La Pagnottella Gourmet.
- Gli utenti standard non vedono la scelta: dall'hub vengono indirizzati ad Alimentari Russo.
- La Pagnottella puo' essere resa raggiungibile agli utenti tramite link diretto usando il controllo nell'hub amministratore.
- Se La Pagnottella non e' pubblicata, un accesso diretto di un utente standard viene riportato su Alimentari Russo.

## Configurazione Firestore

Documento: `app_config/suppliers`

```json
{
  "russo": { "enabledForUsers": true },
  "pagnottella": { "enabledForUsers": false }
}
```

Il frontend usa valori conservativi se il documento non esiste o non e' leggibile: Russo attivo, Pagnottella riservata all'admin. Le regole Firestore consentono la scrittura del documento solo all'admin.

## Ordini Pagnottella

Gli ordini sono salvati nella raccolta condivisa `orders` prima dell'apertura di WhatsApp. I campi distintivi sono:

- `supplierId: "pagnottella"`
- `supplierName: "La Pagnottella Gourmet"`
- `source: "dosepranza-2"`
- `paymentMethod`
- `company`
- `deliveryAddress`
- `pointOfSale`
- `discountRate` e `discountAmount`
- `items`, `total`, `allergies` e stati ordine/pagamento in forma strutturata

Il riepilogo WhatsApp, l'IBAN e l'intestatario del bonifico non vengono duplicati nel documento ordine. Il log locale conserva soltanto metadati sintetici e migra automaticamente eventuali record precedenti eliminando riepiloghi e note testuali.

L'amministratore vede gli ordini di entrambi i fornitori. Il ristoratore Russo vede nel frontend operativo solo gli ordini Russo.

## Pagamenti

Metodi selezionabili: Contanti, POS, Bonifico bancario e Satispay.

PayPal e Nexi restano presenti come opzioni disabilitate. Per attivarli da settembre occorre prima aggiungere gli estremi operativi e impostare `enabled: true` in `payment.futureMethods` dentro `assets/pagnottella/data/menu.json`.

## Immagini prodotto

La sorgente autorevole e' `assets/pagnottella/data/source-audit-completo/`.

```bash
npm run sync:pagnottella-images
npm run report:pagnottella-images
```

La regola e' conservativa: solo gli asset marcati `pubblicabile = si` sono mostrati come foto prodotto. Gli altri prodotti usano il logo Pagnottella come fallback neutro.

## Rilascio coordinato

```bash
bash scripts/netlify_preflight.sh
BASE_URL='http://127.0.0.1:8081/?e2e=1' npx playwright test
bash scripts/netlify_publish_pdf.sh
firebase deploy --only firestore:rules --project app-ordini-pranzo-alimentari
```

Il frontend che interroga i propri ordini per `uid` e le nuove regole Firestore devono essere rilasciati nella stessa finestra. Dopo il rilascio verificare:

1. login Google admin;
2. controllo visibilita Pagnottella;
3. redirect utente standard verso Russo;
4. ordine Pagnottella salvato in `orders`;
5. ordine visibile all'admin con badge fornitore;
6. riepilogo Russo privo di ordini Pagnottella.
