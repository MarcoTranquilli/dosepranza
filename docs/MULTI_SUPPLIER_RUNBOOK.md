# DOSepranza 2.0 - Runbook go-live multi-fornitore

Release freeze: 30 luglio 2026.

## Link operativi

- Link ufficiale utenti: `https://app-dosepranza.netlify.app/`
- Fallback GitHub Pages: `https://marcotranquilli.github.io/dosepranza/`
- Reset cache: `https://marcotranquilli.github.io/dosepranza/?swreset=1`
- Diagnostica sicura: `https://marcotranquilli.github.io/dosepranza/pagnottella-gourmet/?suite=production&authdebug=1`
- Russo tecnico: `https://marcotranquilli.github.io/dosepranza/russo/?suite=production`
- Approval Pagnottella, solo supporto/stakeholder: `https://marcotranquilli.github.io/dosepranza/pagnottella-approval/pagnottella-preview/?review=sponsor`

Distribuire agli utenti esclusivamente il link ufficiale Netlify.

## Accessi attesi

| Profilo | Accesso |
| --- | --- |
| Marco Tranquilli | Amministratore; entrambi i fornitori e viste globali |
| Account che termina esattamente con `@dos.design` | Utente DOS; Russo e Pagnottella, senza amministrazione o viste globali |
| Commerciale Pagnottella | Solo Pagnottella e relativi ordini |
| Account Russo autorizzati | Solo Russo e relativi ordini |
| Altri account | Non autorizzati |

Il ruolo viene sempre ricalcolato dall'email Google verificata. Il ruolo presente in `localStorage` non concede privilegi.

## Supporto rapido

Chiedere all'utente soltanto:

1. email usata;
2. browser e dispositivo;
3. screenshot del messaggio;
4. se la scelta account Google si apre;
5. screenshot della pagina `authdebug=1`.

Non chiedere token, UID, contenuto completo di `localStorage` o dati ordine.

### Cache vecchia

1. Chiudere le schede DOSepranza aperte.
2. Aprire il link Reset cache.
3. Attendere l'apertura della suite e aggiornare una sola volta.
4. Se il problema resta, usare una finestra anonima.

### Popup Google bloccato

1. Consentire temporaneamente i popup per `marcotranquilli.github.io`.
2. Premere nuovamente `Accedi con Google`.
3. Se il popup non completa l'accesso, il sistema avvia il fallback redirect.

### Account errato o non autorizzato

1. Uscire con `Cambia utente`.
2. Selezionare l'account aziendale `@dos.design`.
3. Verificare che il dominio termini esattamente con `@dos.design`.

### Secondo login entrando in Russo

Tornare alla suite e riaprire Russo. La sessione Google deve essere condivisa. Se il problema persiste, usare Reset cache e acquisire `authdebug`.

### QR Russo non visibile

Aggiornare la pagina Russo dopo Reset cache. Il link alternativo è il pulsante `Apri Satispay`; non comunicare URL diversi da quello presente nell'app.

### Ordine non salvato

1. Non procedere al pagamento una seconda volta senza verifica.
2. Conservare il carrello e riprovare una volta.
3. Acquisire screenshot, ora, email e fornitore.
4. Il supporto verifica l'ordine senza richiedere dati di pagamento.

## Controlli operativi giornalieri

- Login con account autorizzato.
- Entrambe le card visibili agli utenti DOS.
- QR Satispay Russo visibile.
- Catalogo e carrello Pagnottella disponibili.
- Riepilogo ordini visibile al relativo fornitore.
- Nessun errore bloccante in console.

## Dati e backfill

Gli ordini nuovi includono `supplierId`. Il backfill degli ordini Russo storici senza `supplierId` non è stato eseguito e resta un'attività separata, non necessaria al go-live.

## Contatto

Supporto interno: Marco Tranquilli, canale Slack aziendale.
