# Core Guardrails

## Obiettivo
Proteggere i flussi core di DOSepranza da regressioni durante futuri sviluppi.

## Flussi core da considerare bloccanti
1. Accesso utente con `nome + mail`.
2. Accesso staff con riconoscimento ruolo coerente.
3. Visualizzazione `I tuoi ordini`.
4. Visualizzazione `TUTTI` con:
   - KPI pagamenti
   - riepilogo cucina
   - lista ordini da riconciliare
5. Gestione menu admin.
6. Flussi `Fridge` per staff.

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
