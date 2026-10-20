import {pathToFileURL} from 'node:url';

export async function manageDomain(command, name, apiKey, {fetchImpl = fetch} = {}) {
  if (!['create', 'check'].includes(command)) throw new Error('Usare create oppure check.');
  name = String(name || '').trim().toLowerCase();
  if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(name)) throw new Error('Dominio non valido.');
  if (!apiKey?.trim()) throw new Error('Impostare RESEND_API_KEY (chiave con accesso gestione domini).');
  async function request(path, method = 'GET', body) {
    let response;
    try {
      response = await fetchImpl(`https://api.resend.com${path}`, {
        method, signal:AbortSignal.timeout(20000),
        headers:{Authorization:`Bearer ${apiKey}`, 'Content-Type':'application/json'},
        ...(body ? {body:JSON.stringify(body)} : {})
      });
    } catch { throw new Error('Connessione Resend fallita o timeout.'); }
    if (!response.ok) throw new Error(`Resend HTTP ${response.status}; verificare permessi, quota e configurazione.`);
    try { return await response.json(); } catch { throw new Error('Risposta Resend non valida.'); }
  }
  let domain, after;
  const seen = new Set();
  do {
    const page = await request(`/domains?limit=100${after ? `&after=${encodeURIComponent(after)}` : ''}`);
    if (!Array.isArray(page.data)) throw new Error('Elenco domini non valido.');
    domain = page.data.find(item => item.name?.toLowerCase() === name);
    if (domain || !page.has_more) break;
    after = page.data.at(-1)?.id;
    if (!after || seen.has(after)) throw new Error('Paginazione Resend non valida.');
    seen.add(after);
  } while (true);
  if (!domain) {
    if (command === 'check') throw new Error('Dominio assente: eseguire prima create.');
    domain = await request('/domains', 'POST', {name, region:'eu-west-1'});
  }
  if (!domain.id) throw new Error('ID dominio mancante nella risposta.');
  const path = `/domains/${encodeURIComponent(domain.id)}`;
  if (command === 'check') await request(`${path}/verify`, 'POST');
  const result = await request(path);
  if (!Array.isArray(result.records)) throw new Error('Record DNS assenti nella risposta.');
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, name, flag, key] = process.argv.slice(2);
  try {
    if (flag && (flag !== '--api-key' || !key)) throw new Error('Argomento opzionale: --api-key CHIAVE. Preferire RESEND_API_KEY per evitare cronologia shell.');
    const domain = await manageDomain(command, name, key || process.env.RESEND_API_KEY);
    console.log(`Dominio: ${domain.name} | Regione: ${domain.region} | Stato: ${domain.status}`);
    console.table(domain.records.map(r => ({Tipo:r.type, 'Nome Host':r.name, Valore:r.value, Priorita:r.priority ?? '-', Stato:r.status})));
    if (domain.status !== 'verified') console.log('Verifica non completata: inserire i record DNS e ripetere check dopo la propagazione.');
    if (domain.region !== 'eu-west-1') console.log('Attenzione: dominio esistente in regione diversa; nessuna modifica automatica.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
