# Core Guardrails

## Obiettivo
Proteggere i flussi core di DOSepranza da regressioni durante futuri sviluppi.

## Flussi core da considerare bloccanti
1. Accesso utente con sessione Google verificata; `localStorage` non e' una sorgente di autorizzazione in produzione.
2. Accesso staff con riconoscimento ruolo coerente.
3. Visualizzazione `I tuoi ordini`.
4. Visualizzazione `TUTTI` con:
   - KPI pagamenti
   - riepilogo cucina
   - lista ordini da riconciliare
5. Gestione menu admin.
6. Flussi `Fridge` per staff.
7. Instradamento multi-fornitore:
   - scelta fornitore visibile solo all'admin
   - utenti standard indirizzati ad Alimentari Russo
   - admin sempre autorizzato su tutti i fornitori
8. Salvataggio ordine Pagnottella su Firestore prima dell'apertura di WhatsApp.

## Regole operative
1. Il percorso dati core deve avere una sola sorgente primaria.
   Per il riepilogo ordini, il canale primario e' `frontend -> Firestore`.
2. Ogni fallback deve essere opzionale e rimovibile.
3. Nessun fallback puo' diventare obbligatorio senza test dedicati.
4. Le regole Firestore e il frontend devono essere modificate nello stesso change set quando toccano i medesimi flussi.
5. Nessuna modifica ai ruoli puo' essere rilasciata senza verificare almeno:
   - utente standard
   - admin
   - ristoratore
   - facility
6. Le modifiche a `supplier-access.js`, `app_config/suppliers` o al payload ordini richiedono test multi-ruolo e test del salvataggio ordine.

## Guardrail automatici gia' attivi
1. UAT Playwright su GitHub Actions.
2. Fixture E2E deterministiche per gli ordini core.
3. Assert espliciti su:
   - conteggio ordini
   - importo totale
   - utenti presenti nel riepilogo
   - prodotti presenti nel riepilogo

## Regola di modifica
Se un intervento tocca uno di questi punti:
- `syncOrders`
- `syncMyOrders`
- `setRole`
- `onAuthStateChanged`
- `FIRESTORE_RULES_ENTERPRISE.txt`

allora il change deve includere anche almeno una di queste azioni:
1. aggiornamento test E2E
2. nuova fixture
3. nota architetturale in `docs/SECURE_IMPLEMENTATION_PLAN.md`

## Anti-pattern da evitare
1. Sommare piu' fallback sullo stesso flusso core senza rimuovere quelli precedenti.
2. Cambiare i permessi Firestore senza allineare il frontend.
3. Far dipendere i flussi core da un host secondario non garantito.
4. Introdurre logiche diverse tra ambiente reale ed E2E senza documentarle.
