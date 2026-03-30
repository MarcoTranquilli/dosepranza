# Secure Implementation Plan

## Obiettivo
Evolvere DOSepranza senza perdere i flussi core e riportare gradualmente il sistema a un modello piu' sicuro.

## Stato attuale
Il sistema e' in `recovery mode` per il riepilogo ordini:
1. il frontend legge direttamente Firestore
2. il riconoscimento staff usa anche fallback applicativi
3. le regole Firestore sono temporaneamente piu' permissive del target finale

Questo stato e' accettabile per continuita' operativa, non come assetto finale.

## Architettura target
1. `Frontend`
   - UI
   - validazione leggera
   - nessuna logica autorizzativa critica
2. `Backend trusted`
   - endpoint staff per ordini, riconciliazione, analytics
   - verifica token Firebase
   - audit
3. `Firestore`
   - accesso diretto limitato ai casi strettamente necessari
   - regole minimali e coerenti col backend

## Strategia consigliata

### Fase 1 - Stabilizzazione
1. mantenere il percorso diretto Firestore per gli ordini finche' il sistema resta stabile
2. non reintrodurre fallback multipli sul riepilogo ordini
3. mantenere i nuovi test E2E come criterio minimo di rilascio

### Fase 2 - Backend staff sicuro
1. riattivare un host affidabile per le function staff
2. spostare su backend:
   - elenco ordini staff
   - riconciliazione
   - export
   - analytics staff
3. lasciare il frontend come consumer di una sola API staff

### Fase 3 - Hardening permessi
1. restringere gradualmente le regole Firestore
2. rimuovere l'accesso diretto staff generalizzato a `orders`
3. mantenere solo:
   - utenti: propri ordini
   - backend: tutti gli ordini

### Fase 4 - Controlli di rilascio
1. ambiente `staging`
2. smoke test su build candidata
3. checklist release con verifica dei flussi core

## Requisiti minimi per ogni sviluppo futuro
1. se tocchi auth o ruoli:
   - testare `admin`, `ristoratore`, `facility`, `user`
2. se tocchi ordini:
   - testare `I tuoi ordini`
   - testare `TUTTI`
   - testare KPI e riconciliazione
3. se tocchi Firestore rules:
   - verificare coerenza con il frontend nello stesso PR

## Segnale di blocco rilascio
Il rilascio va fermato se una delle condizioni seguenti fallisce:
1. `TUTTI` non mostra gli ordini fixture nel test staff
2. il totale ordini non combacia con la fixture
3. il ruolo staff non abilita le viste corrette
4. l'utente standard perde `I tuoi ordini`
