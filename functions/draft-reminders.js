const {randomUUID, createHash} = require('node:crypto');
const suppliers = require('./config/suppliers');
const {windowFor} = require('./russo-batch');

function eligible(draft, supplierId, day) {
  return draft.supplierId === supplierId && draft.day === day && draft.status === 'DRAFT'
    && draft.reminderSent === false && Array.isArray(draft.items) && draft.items.length > 0 && !draft.orderId
    && !draft.finalizedAt && /^[^\s@]+@dos\.design$/.test(draft.userEmail || '');
}

async function runReminders({db, transporter, supplierId, scheduledAt, clock = () => new Date()}) {
  const supplier = suppliers[supplierId];
  if (!supplier) throw new Error('reminder_invalid_supplier');
  const window = windowFor(scheduledAt, supplier);
  const start = window.cutoff.getTime() - supplier.reminderMinutesBeforeCutoff * 60000;
  if (clock().getTime() < start || clock() >= window.cutoff) return {status:'OUTSIDE_WINDOW'};
  const drafts = await db.collection('drafts').where('supplierId','==',supplierId)
    .where('day','==',window.day).where('status','==','DRAFT').where('reminderSent','==',false).limit(501).get();
  if (drafts.size > 500) throw new Error('reminder_too_many_drafts');
  let sent = 0, review = 0;
  for (const doc of drafts.docs) {
    if (clock() >= window.cutoff) break;
    const initial = doc.data();
    if (!eligible(initial, supplierId, window.day)) continue;
    const key = createHash('sha256').update(`${window.day}:${supplierId}:${initial.userEmail}`).digest('hex');
    const receipt = db.doc(`draft_reminders/${key}`), owner = randomUUID();
    const claimed = await db.runTransaction(async tx => {
      const [fresh, previous] = await Promise.all([tx.get(doc.ref), tx.get(receipt)]);
      if (previous.exists || !fresh.exists || !eligible(fresh.data(),supplierId,window.day)
        || fresh.data().userEmail !== initial.userEmail || clock() >= window.cutoff) return false;
      // A durable claim is never automatically retried: SMTP delivery can be uncertain.
      tx.set(receipt,{status:'SENDING',owner,supplierId,day:window.day,createdAt:clock().toISOString()});
      return true;
    });
    if (!claimed) continue;
    try {
      const fresh = await doc.ref.get();
      if (!fresh.exists || !eligible(fresh.data(),supplierId,window.day) || fresh.data().userEmail !== initial.userEmail || clock() >= window.cutoff) {
        await receipt.update({status:'SKIPPED'});
        continue;
      }
      const result = await transporter.sendMail({
        from:supplier.fromHeader, to:[initial.userEmail], messageId:`<draft-${key}@dos.design>`,
        subject:`DOSepranza - Completa il tuo ordine ${supplier.displayName}`,
        text:`Hai un carrello non finalizzato per ${supplier.displayName}. Completa conferma e pagamento entro le ${supplier.cutoffTimeRome}. Se hai gia completato l'ordine, ignora questo promemoria. https://app-dosepranza.netlify.app/`
      });
      if (!result.accepted?.includes(initial.userEmail)) throw new Error('uncertain');
      await receipt.update({status:'ACCEPTED',processedAt:clock().toISOString()});
      await doc.ref.update({reminderSent:true,reminderSentAt:clock().toISOString()});
      sent++;
    } catch {
      await receipt.update({status:'REVIEW_REQUIRED'});
      review++;
    }
  }
  return {status:'COMPLETED',sent,review};
}
module.exports = {runReminders, eligible};
