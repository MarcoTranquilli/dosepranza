const {randomUUID} = require('node:crypto');
const ADMIN = 'marco.tranquilli@dos.design';
const fail = code => Object.assign(new Error(code), {code});
const parts = date => Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
  timeZone:'Europe/Rome', year:'numeric', month:'2-digit', day:'2-digit',
  hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'
}).formatToParts(date).map(part => [part.type, part.value]));

function windowFor(date) {
  if (!Number.isFinite(date.getTime())) throw fail('batch_invalid_schedule');
  const p = parts(date), day = `${p.year}-${p.month}-${p.day}`;
  const civil = hour => {
    const target = Date.parse(`${day}T${hour}:00:00Z`);
    let value = target;
    for (let i = 0; i < 3; i++) {
      const q = parts(new Date(value));
      value += target - Date.parse(`${q.year}-${q.month}-${q.day}T${q.hour}:${q.minute}:${q.second}Z`);
    }
    return value;
  };
  return {day, start:new Date(civil('00')), cutoff:new Date(civil('10') + 30 * 60000)};
}

function summarize(docs, window) {
  let totalCents = 0, count = 0;
  const users = new Set();
  const excluded = /^(cancelled|canceled|annullato|draft|bozza|void|refunded)$/i;
  for (const doc of docs) {
    const o = doc.data();
    const date = o.createdAt?.toDate?.() || new Date(o.createdAt);
    if (o.supplierId !== 'russo' || !Number.isFinite(date.getTime()) || date < window.start || date >= window.cutoff
      || o.isTest === true || o.test === true || o.e2e === true || (o.orderType && o.orderType !== 'order')
      || [o.status, o.orderStatus, o.paymentStatus].some(s => excluded.test(s || ''))) continue;
    const cents = Math.round(o.total * 100);
    if (typeof o.total !== 'number' || !Number.isSafeInteger(cents) || cents <= 0
      || Math.abs(o.total * 100 - cents) > 0.00001) throw fail('batch_invalid_amount');
    totalCents += cents;
    if (!Number.isSafeInteger(totalCents)) throw fail('batch_invalid_amount');
    count++;
    const email = String(o.email || '').trim().toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) users.add(email);
    else throw fail('batch_invalid_recipient');
  }
  return {totalCents, orderCount:count, recipients:[...users].sort()};
}

function envelope(summary, day, from, recipient) {
  const confirmed = summary.totalCents >= 2000;
  const total = (summary.totalCents / 100).toFixed(2).replace('.', ',');
  const message = confirmed
    ? "La soglia minima di 20,00 EUR e' stata raggiunta. L'ordine collettivo e' confermato e in preparazione."
    : "Alle 10:30 la soglia minima di 20,00 EUR non e' stata raggiunta: gli ordini Alimentari Russo per oggi sono annullati. La Pagnottella Gourmet resta ordinabile fino alle 12:00.";
  return {
    from, to:[recipient],
    subject: confirmed ? 'DOSepranza - Ordine Confermato Alimentari Russo'
      : 'DOSepranza - Ordine Russo Non Confermato (soglia minima non raggiunta)',
    text: `DOSepranza | Alimentari Russo | ${day}\n${message}\nTotale raccolto: ${total} EUR. Numero di ordini: ${summary.orderCount}.`,
    html: `<h1>Alimentari Russo</h1><p>${day}</p><p>${message}</p><p><strong>Totale raccolto: ${total} EUR</strong><br>Numero di ordini: ${summary.orderCount}</p>`
  };
}

async function runBatch({db, apiKey, from = 'onboarding@resend.dev', scheduledAt,
  clock = () => new Date(), fetchImpl = fetch, serverTimestamp = () => new Date()}) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw fail('batch_missing_configuration');
  from = typeof from === 'string' ? from.trim() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)) from = 'onboarding@resend.dev';
  const window = windowFor(scheduledAt), now = clock().getTime();
  if (now < window.cutoff.getTime()) throw fail('batch_before_cutoff');
  const ref = db.doc(`daily_batches/${window.day}_russo`), owner = randomUUID();
  const claim = await db.runTransaction(async tx => {
    const snapshot = await tx.get(ref), existing = snapshot.exists ? snapshot.data() : null;
    if (existing?.status === 'PROCESSED') return null;
    if (existing?.status === 'REVIEW_REQUIRED') throw fail('batch_manual_review_required');
    if (existing && existing.mode !== 'LIVE_V1') throw fail('batch_incompatible_existing_batch');
    if (existing?.leaseUntilMs > now) throw fail('batch_in_progress');
    // Resend retains idempotency keys for 24h. Never retry an uncertain send beyond that window.
    if (existing && now - existing.firstAttemptAtMs >= 23 * 3600000) {
      tx.update(ref, {status:'REVIEW_REQUIRED', updatedAt:serverTimestamp()});
      return {review:true};
    }
    let batch = existing;
    if (!batch) {
      const query = db.collection('orders').where('supplierId', '==', 'russo')
        .where('createdAt', '>=', window.start).where('createdAt', '<', window.cutoff)
        .orderBy('createdAt', 'desc').limit(1001);
      const orders = await tx.get(query);
      if (orders.docs.length > 1000) throw fail('batch_too_many_orders');
      const summary = summarize(orders.docs, window);
      batch = {...summary, mode:'LIVE_V1', day:window.day, supplierId:'russo',
        decision:summary.totalCents >= 2000 ? 'CONFIRMED' : 'NOT_CONFIRMED',
        envelopes:[...new Set([...summary.recipients, ADMIN])].sort().map(email => envelope(summary, window.day, from, email)), firstAttemptAtMs:now,
        idempotencyKey:`russo-live-v1-${window.day}`};
    }
    const expected = [...new Set([...batch.recipients, ADMIN])].sort();
    if (!Array.isArray(batch.envelopes) || batch.envelopes.length !== expected.length
      || batch.envelopes.some((mail, i) => JSON.stringify(mail.to) !== JSON.stringify([expected[i]]) || mail.cc || mail.bcc)) {
      throw fail('batch_invalid_recipient');
    }
    if (batch.envelopes.some(mail => mail.from === 'onboarding@resend.dev' && mail.to[0] !== ADMIN)) {
      throw fail('batch_verified_sender_required');
    }
    tx.set(ref, {...batch, status:'PROCESSING', owner, leaseUntilMs:now + 180000, updatedAt:serverTimestamp()});
    return batch;
  });
  if (!claim) return {status:'ALREADY_PROCESSED', day:window.day};
  if (claim.review) return {status:'REVIEW_REQUIRED', day:window.day};
  try {
    const messageIds = [];
    for (let offset = 0; offset < claim.envelopes.length; offset += 100) {
      const chunk = claim.envelopes.slice(offset, offset + 100);
      const response = await fetchImpl('https://api.resend.com/emails/batch', {
        method:'POST', signal:AbortSignal.timeout(20000),
        headers:{Authorization:`Bearer ${apiKey}`, 'Content-Type':'application/json', 'Idempotency-Key':`${claim.idempotencyKey}-${offset / 100}`},
        body:JSON.stringify(chunk)
      });
      if (!response.ok) throw fail(`batch_resend_http_${response.status}`);
      const result = await response.json();
      if (!Array.isArray(result.data) || result.data.length !== chunk.length || result.data.some(x => typeof x.id !== 'string' || !x.id)) throw fail('batch_invalid_provider_response');
      messageIds.push(...result.data.map(x => x.id));
    }
    await db.runTransaction(async tx => {
      const latest = await tx.get(ref);
      if (latest.data()?.owner !== owner) throw fail('batch_lease_lost');
      tx.update(ref, {status:'PROCESSED', processedAt:clock().toISOString(), leaseUntilMs:0,
        total:claim.totalCents / 100, ordersCount:claim.orderCount, recipients:claim.envelopes.map(mail => mail.to[0]),
        deliveryStatus:'ACCEPTED', resendMessageIds:messageIds});
    });
    return {status:'PROCESSED', day:window.day, totalCents:claim.totalCents, orderCount:claim.orderCount};
  } catch (error) {
    const code = /^batch_[a-z0-9_]+$/.test(error.code || '') ? error.code : 'batch_send_uncertain';
    await db.runTransaction(async tx => {
      const latest = await tx.get(ref);
      if (latest.data()?.owner === owner && latest.data()?.status !== 'PROCESSED') {
        tx.update(ref, {status:'RETRYABLE', leaseUntilMs:0, lastError:code, updatedAt:serverTimestamp()});
      }
    });
    throw fail(code);
  }
}

module.exports = {runBatch, windowFor, summarize, envelope, ADMIN};
