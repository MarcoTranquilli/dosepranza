# UAT Checklist – DOSepranza

## Navigazione & UI
- Menu: visualizza prodotti, filtri funzionanti
- Crea: base + ingredienti + riepilogo prezzo
- Ordine: carrello, note, posate, totale
- Tutti: lista ordini, KPI, riepilogo cucina
- Analisi: KPI, grafici, filtri

## Flusso Ordini
- Aggiungi prodotto al carrello
- Invia ordine
- Verifica ordine in “Tutti”

## Riconciliazione
- Filtro “Da verificare”
- Segna pagato
- Riconcilia selezionati

## Ruoli
- Admin: vede export storico
- Ristoratore: vede “Tutti” e “Analisi”
- Facility: accesso Frige
- Standard: Frige non visibile (WIP) e vede solo i propri ordini

## Blocco orario
- Dopo 11:30: menu bloccato, solo Frige (staff)

## Esportazioni
- CSV conforme al formato richiesto
- Copia Comanda
- Copia Cucina

## Firestore
- Nessun errore permission-denied
- Utente standard: lettura consentita dei propri ordini (`uid == request.auth.uid`)
- Staff: lettura completa ordini/frige
