const suppliers=require('../config/suppliers');
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const euro=c=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(c/100);
const n=v=>new Intl.NumberFormat('it-IT',{maximumFractionDigits:2}).format(v);
const local=d=>new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',day:'2-digit',month:'long',year:'numeric'}).format(d);
const pct=(a,b)=>b?`${n(100*a/b)}%`:'n.d.';
function renderDigest(report,generatedAt=new Date(), {supplierId=null}={}) {
  if(supplierId && (!suppliers[supplierId] || Object.keys(report.suppliers).length!==1 || !report.suppliers[supplierId])) throw new Error('digest_invalid_scope');
  const sections=[], plain=[];
  const period=`${local(report.window.start)} – ${local(new Date(report.window.end.getTime()-1))}`;
  const heading=(title,subtitle='')=>{sections.push(`<h2 style="font:700 23px Georgia,serif;color:#203b35;margin:28px 0 8px">${escape(title)}</h2>${subtitle?`<p style="color:#64716d;font-size:13px;margin:0 0 14px">${escape(subtitle)}</p>`:''}`);plain.push(`\n${title}\n${subtitle}`);};
  function table(headers,rows) {
    plain.push(headers.join(' | '),...rows.map(r=>r.join(' | ')));
    sections.push(`<table width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13px;table-layout:fixed"><thead><tr>${headers.map(h=>`<th scope="col" align="left" style="padding:10px 7px;background:#eaf0ed;color:#203b35;border-bottom:2px solid #ccd8d1;overflow-wrap:anywhere">${escape(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r,i)=>`<tr>${r.map(v=>`<td style="padding:10px 7px;vertical-align:top;border-bottom:1px solid #e4e8e5;background:${i%2?'#f7f9f7':'#ffffff'};overflow-wrap:anywhere;word-break:break-word">${escape(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
  }
  function paragraph(s){sections.push(`<p style="font-size:13px;line-height:1.65;color:#53615b">${escape(s)}</p>`);plain.push(s);}
  const all=report.overall, entries=Object.entries(report.suppliers);
  heading('Sintesi esecutiva','Dati di utilizzo e valore ordinato. Documento riservato all’amministratore.');
  table(['Ordini finalizzati','Valore ordinato','Utenti attivi','Scontrino medio'],[[n(all.orders),euro(all.revenueCents),n(all.activeUsers),euro(all.aovCents)]]);
  const pending=Math.max(0,all.started-all.convertedAttempts);
  paragraph(`${n(all.started)} tentativi osservati, ${n(all.convertedAttempts)} convertiti (${n(all.conversionPct)}%). ${n(pending)} tentativi senza ordine finalizzato associato. Frequenza media: ${n(all.ordersPerUser)} ordini per utente; spesa media per utente: ${euro(all.spendPerUserCents)}; articoli medi per ordine: ${n(all.itemsPerOrder)}.`);
  if(!supplierId) {
  heading('Confronto fornitori');
  table(['Fornitore','Ordini / quota','Valore / quota','Conversione stimata'],entries.map(([id,s])=>[suppliers[id].displayName,`${n(s.orders)} / ${pct(s.orders,all.orders)}`,`${euro(s.revenueCents)} / ${pct(s.revenueCents,all.revenueCents)}`,`${n(s.conversionPct)}%`]));
  paragraph('Gli utenti attivi complessivi sono deduplicati tra i fornitori: la somma degli utenti delle singole schede può essere maggiore del totale. Nessun confronto con periodi precedenti è incluso.');
  }
  for(const [id,s] of entries) {
    heading(suppliers[id].displayName,`Chiusura ordini configurata: ${suppliers[id].cutoffTimeRome} · Europe/Rome`);
    table(['Indicatore','Risultato'],[
      ['Tentativi osservati / convertiti',`${n(s.started)} / ${n(s.convertedAttempts)}`],
      ['Conversione stimata',`${n(s.conversionPct)}%`],['Ordini finalizzati / utenti attivi',`${n(s.orders)} / ${n(s.activeUsers)}`],
      ['Valore ordinato / scontrino medio',`${euro(s.revenueCents)} / ${euro(s.aovCents)}`],
      ['Articoli totali / media per ordine',`${n(s.units)} / ${n(s.itemsPerOrder)}`],
      ['Spesa media per utente',euro(s.spendPerUserCents)],['Ordini medi per utente',n(s.ordersPerUser)],
      ['Tentativi senza ordine associato',n(Math.max(0,s.started-s.convertedAttempts))]]);
    const hours=s.hourly.map((count,h)=>[`${String(h).padStart(2,'0')}:00–${String(h+1).padStart(2,'0')}:00`,count]).filter(([,count])=>count>0);
    heading('Quando si ordina','Le fasce orarie senza ordini sono omesse. Gli ordini dal cutoff sono già inclusi nelle fasce.');
    table(['Fascia oraria Roma','Ordini','Quota'],hours.length?hours.map(([h,c])=>[h,n(c),pct(c,s.orders)]):[['Nessun ordine','0','n.d.']]);
    paragraph(`Ordini con timestamp dal cutoff delle ${suppliers[id].cutoffTimeRome}: ${n(s.postCutoff)}. Da verificare se presenti: il confronto usa la configurazione attuale, non uno storico delle policy.`);
    table(['Giorno','Ordini','Quota'],s.weekdays.map((c,i)=>[['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'][i],n(c),pct(c,s.orders)]));
    for(const [label,values] of [['Prodotti più venduti · quantità',s.topByQuantity],['Prodotti più venduti · valore',s.topByRevenue],['Mix per categoria',s.categories]]) {
      heading(label);
      table(['Prodotto / categoria','Quantità','Valore articoli'],values.length?values.map(v=>[v.name,n(v.quantity),euro(v.revenueCents)]):[['Nessun dato','0',euro(0)]]);
    }
    heading('Top 5 clienti','Ordinamento per valore ordinato decrescente. Identificativi riservati all’amministratore.');
    table(['Utente','Ordini','Valore totale','Media ordine'],s.topUsers.length?s.topUsers.map(u=>[u.name,n(u.orders),euro(u.revenueCents),euro(u.aovCents)]):[['Nessun utente','0',euro(0),euro(0)]]);
  }
  heading('Qualità e copertura dei dati');
  const labels={malformedOrders:'Ordini malformati esclusi',malformedDrafts:'Bozze malformate escluse',excludedOrders:'Ordini esclusi per stato o test',unknownSupplier:'Record con fornitore non riconosciuto',unmatchedConfirmedDrafts:'Bozze confermate senza ordine associato',productTotalMismatch:'Differenze tra valore articoli e totale ordine'};
  table(['Controllo','Record'],Object.entries(report.diagnostics).map(([key,value])=>[labels[key]||key,n(value)]));
  heading('Come leggere questo report');
  paragraph('Conversione stimata = tentativi convertiti / tentativi osservati. Un tentativo è identificato da giorno, utente e fornitore: più ordini nello stesso giorno valgono un solo tentativo convertito, ma restano ordini distinti nelle medie. Bozze eliminate o sovrascritte possono rendere il funnel incompleto. Un tentativo senza ordine associato non prova un abbandono.');
  paragraph('Il valore ordinato non è incasso verificato, pagamento riconciliato o prova di consegna. Ordini annullati, rimborsati e di test sono esclusi. Il valore dei prodotti usa prezzo unitario × quantità; eventuali sconti o costi a livello ordine non vengono ripartiti artificialmente.');
  paragraph('Le verifiche riguardano i record recuperati: documenti senza il campo temporale richiesto non sono intercettati dalle query. Gli orari sono in Europe/Rome, con gestione del cambio ora legale.');
  heading('Metadati di esecuzione');
  table(['Campo','Valore'],[['Periodo locale incluso',period],['Inizio UTC incluso',report.window.start.toISOString()],['Fine UTC esclusa',report.window.end.toISOString()],['Generazione UTC',generatedAt.toISOString()],['Sorgenti','Firestore /orders e /drafts'],['Modalità',report.window.mode==='week'?'Settimana solare precedente':'Ultimi 30 giorni completi']]);
  const html=`<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DOSepranza · Report amministratore</title></head><body style="margin:0;padding:0;background:#edf1ee;color:#26352e;font-family:Verdana,Arial,sans-serif;line-height:1.5"><div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escape(`${period} · ${all.orders} ordini · ${euro(all.revenueCents)} di valore ordinato`)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px 8px"><table role="presentation" width="680" cellpadding="0" cellspacing="0" style="width:100%;max-width:680px;background:#ffffff"><tr><td style="padding:28px 20px;background:#203b35;color:#ffffff;border-top:5px solid #ce8151"><p style="font-size:12px;letter-spacing:2px;margin:0 0 12px;color:#e7ba97">DOSEPRANZA / BUSINESS REPORT</p><h1 style="font:700 30px Georgia,serif;margin:0 0 12px">${supplierId?escape(suppliers[supplierId].displayName):'Utilizzo e performance ordini'}</h1><p style="margin:0;font-size:14px">${escape(period)}</p></td></tr><tr><td style="padding:0 20px 24px">${sections.join('')}<p style="margin-top:24px"><a href="https://app-dosepranza.netlify.app/" style="display:inline-block;background:#203b35;color:#ffffff;padding:12px 18px;text-decoration:none;font-weight:bold">Apri DOSepranza</a></p></td></tr><tr><td style="padding:18px 20px;background:#eaf0ed;font-size:11px;color:#53615b">RISERVATO · Uso amministrativo interno<br>Report automatico informativo. Non costituisce rendicontazione contabile.</td></tr></table></td></tr></table></body></html>`;
  const text=`DOSEPRANZA | REPORT AMMINISTRATORE\n${period}\nRISERVATO - Uso amministrativo interno\n${plain.join('\n\n')}\n\nApri DOSepranza: https://app-dosepranza.netlify.app/`;
  return {subject:`DOSepranza | ${supplierId?suppliers[supplierId].displayName+' | ':''}Report ordini | ${period}`,text,html};
}
module.exports={renderDigest};
