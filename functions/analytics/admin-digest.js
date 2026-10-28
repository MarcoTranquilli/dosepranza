const {windowFor,calculate}=require('./digest-calculator');
const {renderDigest}=require('./digest-email');
const {createHash}=require('node:crypto');
async function readPagewise(query) {
  const rows=[];let cursor;
  for(;;) {
    const snapshot=await (cursor?query.startAfter(cursor):query).limit(500).get();
    rows.push(...snapshot.docs.map(d=>d.data()));
    if(rows.length>50000) throw new Error('digest_read_limit');
    if(snapshot.docs.length<500) return rows;
    cursor=snapshot.docs.at(-1);
  }
}
async function runDigest({db,transporter,from,recipient=process.env.ADMIN_REPORT_EMAIL||'marco.tranquilli@dos.design',
  now=new Date(),mode='30days',topN=5,logger={warn(){}}}) {
  if(!/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(recipient)||!from||/[\r\n]/.test(from)) throw new Error('digest_invalid_config');
  const window=windowFor(now,mode);
  const orders=await readPagewise(db.collection('orders').where('createdAt','>=',window.start).where('createdAt','<',window.end).orderBy('createdAt'));
  const drafts=await readPagewise(db.collection('drafts').where('day','>=',window.startDay).where('day','<',window.endDay).orderBy('day'));
  const report=calculate(orders,drafts,window,topN);
  logger.warn('Digest data quality (counts only)',report.diagnostics);
  const key=createHash('sha256').update(`${window.startDay}|${window.endDay}|${recipient}`).digest('hex');
  const ref=db.collection('admin_digest_runs').doc(key);
  // Any existing claim blocks replay: SMTP cannot guarantee exactly-once delivery.
  // A crash/ambiguous response requires manual investigation, never automatic resend.
  const acquired=await db.runTransaction(async tx=>{
    if((await tx.get(ref)).exists) return false;
    tx.create(ref,{status:'SENDING',startDay:window.startDay,endDay:window.endDay,startedAt:now.toISOString()});return true;
  });
  if(!acquired) return {status:'SKIPPED_EXISTING'};
  try {
    const result=await transporter.sendMail({from,to:recipient,...renderDigest(report,now),
      messageId:`<digest-${key}@dosepranza.invalid>`,disableFileAccess:true,disableUrlAccess:true});
    if(!Array.isArray(result.accepted)||!result.accepted.some(a=>String(a).toLowerCase()===recipient.toLowerCase())) throw new Error('digest_not_accepted');
    await ref.update({status:'ACCEPTED',processedAt:new Date().toISOString()});
    return {status:'ACCEPTED',orders:report.overall.orders,diagnostics:report.diagnostics};
  } catch {
    await ref.update({status:'REVIEW_REQUIRED'});
    throw new Error('digest_review_required');
  }
}
module.exports={runDigest,readPagewise};
