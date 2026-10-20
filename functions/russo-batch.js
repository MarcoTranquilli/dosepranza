const suppliers = require('./config/suppliers');
const {randomUUID} = require('node:crypto');
const ADMIN = 'marco.tranquilli@dos.design';
function sender(value) {
  const fallback = {value:`Alimentari Russo <${ADMIN}>`, domain:'dos.design'};
  if (typeof value !== 'string' || /[\r\n\x00-\x1f\x7f]/.test(value)) return fallback;
  const clean = value.trim();
  const named = clean.match(/^(?:[^<>"@,;]+|"[^"<>]+")\s*<([^<>]+)>$/);
  const email = named ? named[1] : clean;
  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/.test(email)) return fallback;
  return {value:clean, domain:email.split('@')[1].toLowerCase()};
}
const fail = code => Object.assign(new Error(code), {code});
const parts = date => Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
  timeZone:'Europe/Rome', year:'numeric', month:'2-digit', day:'2-digit',
  hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'
}).formatToParts(date).map(part => [part.type, part.value]));

function windowFor(date, supplier = suppliers.russo) {
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
  const [hour, minute] = supplier.cutoffTimeRome.split(':');
  return {day, start:new Date(civil('00')), cutoff:new Date(civil(hour) + Number(minute) * 60000)};
}

function summarize(docs, window, supplier = suppliers.russo) {
  let totalCents = 0, count = 0;
  const users = new Set();
  const excluded = /^(cancelled|canceled|annullato|draft|bozza|void|refunded)$/i;
  for (const doc of docs) {
    const o = doc.data();
    const date = o.createdAt?.toDate?.() || new Date(o.createdAt);
    if (o.supplierId !== supplier.id || !Number.isFinite(date.getTime()) || date < window.start || date >= window.cutoff
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

function envelope(summary, day, from, recipient, supplier = suppliers.russo) {
  const confirmed = summary.totalCents >= supplier.rules.minTotalCents;
  const total = (summary.totalCents / 100).toFixed(2).replace('.', ',');
  const message = supplier.rules.type === 'DIRECT_CONFIRMATION'
    ? "Il tuo ordine e' confermato. Non e' prevista una soglia minima collettiva."
    : confirmed
    ? "La soglia minima di 20,00 EUR e' stata raggiunta. L'ordine collettivo e' confermato e in preparazione."
    : "Alle 10:30 la soglia minima di 20,00 EUR non e' stata raggiunta: gli ordini Alimentari Russo per oggi sono annullati. Consulta la disponibilita degli altri fornitori nell'app.";
  return {
    from, to:[recipient],
    subject: confirmed ? `DOSepranza - Ordine Confermato ${supplier.displayName}`
      : 'DOSepranza - Ordine Russo Non Confermato (soglia minima non raggiunta)',
    text: `DOSepranza | ${supplier.displayName} | ${day}\n${message}\nTotale raccolto: ${total} EUR. Numero di ordini: ${summary.orderCount}.`,
    html: `<h1>${supplier.displayName}</h1><p>${day}</p><p>${message}</p><p><strong>Totale raccolto: ${total} EUR</strong><br>Numero di ordini: ${summary.orderCount}</p>`
  };
}

async function runBatch({db, transporter, from, scheduledAt, supplierId = 'russo',
  clock = () => new Date(), serverTimestamp = () => new Date()}) {
  if (typeof transporter?.sendMail !== 'function') throw fail('batch_missing_configuration');
  const supplier = suppliers[supplierId];
  if (!supplier) throw fail('batch_invalid_supplier');
  from = sender(from || supplier.fromHeader).value;
  const window = windowFor(scheduledAt, supplier), now = clock().getTime();
  if (now < window.cutoff.getTime()) throw fail('batch_before_cutoff');
  const ref = db.doc(`daily_batches/${window.day}_${supplier.id}`), owner = randomUUID();
  const claim = await db.runTransaction(async tx => {
    const snapshot = await tx.get(ref), existing = snapshot.exists ? snapshot.data() : null;
    if (existing?.status === 'PROCESSED') return null;
    if (existing?.status === 'REVIEW_REQUIRED') throw fail('batch_manual_review_required');
    if (existing && existing.mode !== 'SMTP_V1') throw fail('batch_incompatible_existing_batch');
    if (existing?.leaseUntilMs > now) throw fail('batch_in_progress');
    // SMTP cannot deduplicate an uncertain send: expired SENDING requires review.
    if (existing && (existing.sendingIndex != null || now - existing.firstAttemptAtMs >= 23 * 3600000)) {
      tx.update(ref, {status:'REVIEW_REQUIRED', updatedAt:serverTimestamp()});
      return {review:true};
    }
    let batch = existing;
    if (!batch) {
      const query = db.collection('orders').where('supplierId', '==', supplier.id)
        .where('createdAt', '>=', window.start).where('createdAt', '<', window.cutoff)
        .orderBy('createdAt', 'desc').limit(1001);
      const orders = await tx.get(query);
      if (orders.docs.length > 1000) throw fail('batch_too_many_orders');
      const summary = summarize(orders.docs, window, supplier);
      batch = {...summary, mode:'SMTP_V1', acceptedRecipients:[], messageIds:[], sendingIndex:null, day:window.day, supplierId:supplier.id,
        decision:summary.totalCents >= 2000 ? 'CONFIRMED' : 'NOT_CONFIRMED',
        envelopes:[...new Set([...summary.recipients, ADMIN])].sort().map(email => envelope(summary, window.day, from, email, supplier)), firstAttemptAtMs:now,
        idempotencyKey:`${supplier.id}-smtp-v1-${window.day}`};
    }
    const expected = [...new Set([...batch.recipients, ADMIN])].sort();
    if (!Array.isArray(batch.envelopes) || batch.envelopes.length !== expected.length
      || batch.envelopes.some((mail, i) => JSON.stringify(mail.to) !== JSON.stringify([expected[i]]) || mail.cc || mail.bcc)) {
      throw fail('batch_invalid_recipient');
    }
    if (batch.envelopes.some(mail => {
      const domain = sender(mail.from).domain;
      return (domain === 'resend.dev' || domain.endsWith('.resend.dev')) && mail.to[0] !== ADMIN;
    })) {
      throw fail('batch_verified_sender_required');
    }
    tx.set(ref, {...batch, status:'PROCESSING', owner, leaseUntilMs:now + 180000, updatedAt:serverTimestamp()});
    return batch;
  });
  if (!claim) return {status:'ALREADY_PROCESSED', day:window.day};
  if (claim.review) return {status:'REVIEW_REQUIRED', day:window.day};
  try {
    const accepted = [...(claim.acceptedRecipients || [])], messageIds = [...(claim.messageIds || [])];
    const save = async patch => db.runTransaction(async tx => {
      const latest = await tx.get(ref);
      if (latest.data()?.owner !== owner) throw fail('batch_lease_lost');
      tx.update(ref, {...patch, updatedAt:serverTimestamp()});
    });
    for (let i = 0; i < claim.envelopes.length; i++) {
      const mail = claim.envelopes[i];
      if (accepted.includes(mail.to[0])) continue;
      // Leave enough execution time for SMTP and persistence; resume on scheduler retry.
      if (clock().getTime() - now > 60000) throw fail('batch_time_budget');
      await save({sendingIndex:i});
      let result;
      try {
        result = await transporter.sendMail({...mail, messageId:`<${claim.idempotencyKey}-${i}@dos.design>`});
      } catch (error) {
        // Only explicit authentication/envelope rejection is known not to have sent DATA.
        if (['EAUTH','EENVELOPE'].includes(error.code)) {
          await save({sendingIndex:null});
          throw fail('batch_smtp_rejected');
        }
        throw fail('batch_send_uncertain');
      }
      if (!result.accepted?.includes(mail.to[0]) || result.rejected?.length) throw fail('batch_send_uncertain');
      accepted.push(mail.to[0]);
      messageIds.push(result.messageId || `<${claim.idempotencyKey}-${i}@dos.design>`);
      await save({acceptedRecipients:[...accepted], messageIds:[...messageIds], sendingIndex:null});
    }
    await db.runTransaction(async tx => {
      const latest = await tx.get(ref);
      if (latest.data()?.owner !== owner) throw fail('batch_lease_lost');
      tx.update(ref, {status:'PROCESSED', processedAt:clock().toISOString(), leaseUntilMs:0,
        total:claim.totalCents / 100, ordersCount:claim.orderCount, recipients:claim.envelopes.map(mail => mail.to[0]),
        deliveryStatus:'ACCEPTED', messageIds});
    });
    return {status:'PROCESSED', day:window.day, totalCents:claim.totalCents, orderCount:claim.orderCount};
  } catch (error) {
    const code = /^batch_[a-z0-9_]+$/.test(error.code || '') ? error.code : 'batch_send_uncertain';
    await db.runTransaction(async tx => {
      const latest = await tx.get(ref);
      if (latest.data()?.owner === owner && latest.data()?.status !== 'PROCESSED') {
        tx.update(ref, {status:latest.data().sendingIndex != null ? 'REVIEW_REQUIRED' : 'RETRYABLE', leaseUntilMs:0, lastError:code, updatedAt:serverTimestamp()});
      }
    });
    throw fail(code);
  }
}

module.exports = {runBatch, windowFor, summarize, envelope, ADMIN};
