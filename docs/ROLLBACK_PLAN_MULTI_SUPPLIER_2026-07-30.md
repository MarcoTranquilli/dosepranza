# Piano di rollback DOSepranza multi-fornitore

Non eseguire questo piano salvo incidente bloccante confermato.

## Baseline e riferimenti

- Sorgente stabile precedente al go-live lock: `470b9c6`
- GitHub Pages stabile precedente al go-live lock: `a7fc618`
- Deploy Netlify production corrente: `6a6b043f8f103003fe7b222e`
- Deploy Netlify precedente utilizzabile per continuità Russo-only: `6a5f35a01e05b100088e7020`
- Firebase Rules e indexes: non modificati dal go-live lock.

## Rollback GitHub Pages

Metodo raccomandato: creare un commit di revert, senza force push.

```bash
git fetch origin gh-pages
git worktree add /tmp/dosepranza-rollback origin/gh-pages
cd /tmp/dosepranza-rollback
git switch -c rollback/dosepranza-go-live
git revert <COMMIT_GH_PAGES_GO_LIVE>
git push origin HEAD:gh-pages
```

Attendere lo stato `built` di GitHub Pages e verificare root, Russo e Pagnottella. Il revert deve riportare il contenuto alla baseline `a7fc618`.

Tempo stimato: 10-15 minuti, inclusa propagazione e smoke test.

## Rollback Netlify

Se il redirect ufficiale Netlify è indisponibile:

1. aprire Netlify, progetto `app-dosepranza`, sezione Deploys;
2. selezionare il deploy `6a5f35a01e05b100088e7020`;
3. usare `Publish deploy`;
4. verificare `https://app-dosepranza.netlify.app/`.

Questo rollback riporta temporaneamente alla continuità Russo-only. Non cancellare il deploy multi-fornitore.

Tempo stimato: 5-10 minuti.

## Firebase Rules e indexes

Il go-live lock non modifica Rules o indexes, quindi un rollback frontend non richiede rollback Firebase. In caso di incidente separato sulle Rules, ripristinare la release precedente dalla cronologia Firebase Console e rieseguire l'emulator test prima di pubblicare.

Non cancellare gli indexes durante un incidente: un index inutilizzato non amplia i permessi.

## Impatto e rischi

- Il rollback GitHub Pages rimuove gli ultimi hardening auth e anti-doppio invio.
- Il rollback Netlify precedente limita il servizio alla versione Russo-only.
- Gli ordini già creati non vengono cancellati né migrati.
- Non eseguire backfill durante il rollback.
- Comunicare l'eventuale temporanea indisponibilità di Pagnottella.
