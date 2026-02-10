# DOSepranza – Runbook Operativo (Enterprise)

Data: 2026-02-10

## 1) Check giornaliero (prima delle 10:30)
- Apri la piattaforma e verifica che **Menu** carichi correttamente.
- Verifica che l’utente admin sia riconosciuto (badge/azioni admin visibili).
- Controlla lo stato Firebase (nessun errore `permission-denied`).
- Verifica che il frigo sia disponibile per staff (se attivo).

## 2) Orari chiave
- **Ordini attivi** fino alle 11:30.
- **Dopo le 11:30**: ordini bloccati, Frige (se attivo) rimane disponibile.

## 3) Operatività Ristoratore (11:30)
- Sezione **Tutti** → Copia Comanda → invio su chat.
- Sezione **Tutti** → Copia Cucina → riepilogo per preparazione.
- Verifica **Allergie & Note** nel pannello riepilogo.

## 4) Riconciliazione pagamenti
- Sezione **Tutti** → filtro **Da verificare**.
- Verifica pagamenti e marca **Pagato** quando confermato.
- Usa **Riconcilia selezionati** per batch.

## 5) Esportazioni
- Admin → **Export Storico** per CSV completo.
- Verifica il formato in `export formato applicazione ordini.csv`.

## 6) UAT rapido (post-deploy)
- Menu: ricerca + filtro categoria + diet.
- Aggiunta al carrello + invio ordine.
- Riconoscimento ruolo admin/ristoratore.
- Sezione Tutti: lista ordini, riepilogo e copy.
- Analytics: visualizzazione KPI e grafici.
- Frige: se attivo, verifica acquisto e stock.

## 7) Troubleshooting rapido
- **Menu vuoto / sezioni non visibili**:
  - Hard refresh (Cmd+Shift+R).
  - Verifica `app.v*.js` caricato.
- **Errori Firestore**:
  - Controlla regole Firestore e domini autorizzati.
  - Verifica Anonymous Auth attivo.
- **Icone mancanti**:
  - Verifica CSP `font-src` include cdnjs.

## 8) Contatti
- Admin: marco.tranquilli@dos.design
- Ristoratore: lorenzo.russo@alimentarirusso
- Facility: beatrice.binini@dos.design, monica.porta@dos.design
