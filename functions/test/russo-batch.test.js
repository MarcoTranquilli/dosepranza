const {test} = require('node:test');
const assert = require('node:assert/strict');
const {runBatch, windowFor, ADMIN} = require('../russo-batch');
const scheduledAt = new Date('2026-10-19T08:30:00Z');
const order = (overrides = {}) => ({supplierId:'russo', total:10, email:'collega@dos.design',
  createdAt:new Date('2026-10-19T08:00:00Z'), ...overrides});

function database(rows = [], initial = null, supplierId = 'russo') {
  let batch = initial, queue = Promise.resolve();
  const conditions = [];
  const query = {where(...args) {conditions.push(args); return this;}, orderBy() {return this;}, limit() {return this;}};
  return {
    doc:path => {assert.equal(path, `daily_batches/2026-10-19_${supplierId}`); return {path};},
    collection:name => {assert.equal(name, 'orders'); return query;},
    runTransaction(fn) {
      const work = queue.then(async () => {
        let next = batch;
        const result = await fn({
          get:async ref => ref === query ? {docs:rows.map(o => ({data:() => o}))} : {exists:!!batch, data:() => batch},
          set:(ref, value) => {next = value;}, update:(ref, value) => {next = {...next, ...value};}
        });
        batch = next;
        return result;
      });
      queue = work.catch(() => {});
      return work;
    },
    state:() => batch,
    conditions
  };
}

const accepted = async mail => ({accepted:[...mail.to], rejected:[], messageId:mail.messageId});
const options = db => ({db,scheduledAt,clock:()=>scheduledAt,transporter:{sendMail:accepted},serverTimestamp:()=>scheduledAt});

for (const rows of [[], [order({supplierId:'pagnottella',status:'cancelled'})]]) {
 test('Pagnottella with no eligible orders skips email and batch writes, including retries',async()=>{
  const db=database(rows,null,'pagnottella');
  const time=new Date('2026-10-19T09:00:00Z');
  const opt={...options(db),supplierId:'pagnottella',scheduledAt:time,clock:()=>time,
   transporter:{sendMail:async()=>assert.fail('No email expected')}};
  for(let i=0;i<2;i++) assert.equal((await runBatch(opt)).status,'SKIPPED_NO_ORDERS');
  assert.equal(db.state(),null);
 });
}
test('Pagnottella with one eligible order still sends individual confirmations',async()=>{
 const db=database([order({supplierId:'pagnottella',total:5})],null,'pagnottella'), mails=[];
 const time=new Date('2026-10-19T09:00:00Z');
 await runBatch({...options(db),supplierId:'pagnottella',scheduledAt:time,clock:()=>time,
  transporter:{sendMail:async mail=>{mails.push(mail);return accepted(mail);}}});
 assert.equal(mails.length,2);
 assert.equal(db.state().status,'PROCESSED');
 assert.equal(db.state().ordersCount,1);
});

test('Rome cutoff handles DST and winter',()=>{
 assert.equal(windowFor(scheduledAt).cutoff.toISOString(),'2026-10-19T08:30:00.000Z');
 assert.equal(windowFor(new Date('2026-12-07T10:00:00Z')).cutoff.toISOString(),'2026-12-07T09:30:00.000Z');
 assert.equal(windowFor(new Date('2026-10-25T12:00:00Z')).start.toISOString(),'2026-10-24T22:00:00.000Z');
});
for (const total of [0,19.99,20,25]) test(`SMTP private notification total ${total}`,async()=>{
 const db=database(total?[order({total})]:[]), mails=[];
 const opt={...options(db),transporter:{sendMail:async mail=>{mails.push(mail);return accepted(mail);}}};
 await runBatch(opt);
 assert.equal(mails.length,total?2:1);
 assert.ok(mails.every(m=>m.to.length===1&&!m.cc&&!m.bcc));
 assert.ok(mails.some(m=>m.to[0]===ADMIN));
 assert.ok(mails.every(m=>m.from===`Alimentari Russo <${ADMIN}>`));
 assert.ok(mails.every(m=>m.html&&!m.text.includes('collega@dos.design')));
 assert.ok(mails.every(m=>m.subject.includes(total>=20?'Ordine Confermato':'Ordine Russo Non Confermato')));
 if(total<20) assert.ok(mails.every(m=>m.text.includes('altri fornitori')));
 assert.equal(db.state().status,'PROCESSED'); assert.equal(db.state().total,total);
 assert.equal(db.state().ordersCount,total?1:0);assert.equal(db.state().processedAt,scheduledAt.toISOString());
 assert.equal(db.state().deliveryStatus,'ACCEPTED');
 assert.equal((await runBatch(opt)).status,'ALREADY_PROCESSED');assert.equal(mails.length,total?2:1);
});

test('deduplication and order filtering remain scoped to Russo before cutoff',async()=>{
 const db=database([order({email:' COLLEGA@DOS.DESIGN '}),order(),order({supplierId:'pagnottella'}),order({status:'cancelled'}),order({orderStatus:'annullato'}),order({isTest:true}),order({orderType:'fridge'}),order({createdAt:scheduledAt}),order({createdAt:new Date('2026-10-18T08:00:00Z')})]);
 await runBatch(options(db));assert.equal(db.state().total,20);assert.equal(db.state().ordersCount,2);
 assert.deepEqual(db.state().recipients,['collega@dos.design',ADMIN]);assert.deepEqual(db.conditions[0],['supplierId','==','russo']);
});

test('invalid amount, recipient and missing transport fail before send',async()=>{
 await assert.rejects(runBatch(options(database([order({total:NaN})]))),/batch_invalid_amount/);
 await assert.rejects(runBatch(options(database([order({email:'invalid'})]))),/batch_invalid_recipient/);
 await assert.rejects(runBatch({...options(null),transporter:null}),/batch_missing_configuration/);
});

test('single explicit rejection retries only unsent recipients',async()=>{
 const db=database([order()]), sent=[];let reject=true;
 const opt={...options(db),transporter:{sendMail:async mail=>{
 sent.push(mail.to[0]);if(mail.to[0]===ADMIN&&reject){reject=false;throw Object.assign(Error('private smtp reply'),{code:'EENVELOPE'});}return accepted(mail);
 }}};
 await assert.rejects(runBatch(opt),/batch_smtp_rejected/);assert.equal(db.state().status,'RETRYABLE');
 assert.deepEqual(db.state().acceptedRecipients,['collega@dos.design']);
 await runBatch(opt);assert.deepEqual(sent,['collega@dos.design',ADMIN,ADMIN]);
});

test('uncertain send requires review and is never automatically repeated',async()=>{
 const db=database([order()]);let calls=0;
 const opt={...options(db),transporter:{sendMail:async()=>{calls++;throw Error('secret provider reply');}}};
 await assert.rejects(runBatch(opt),/batch_send_uncertain/);assert.equal(db.state().status,'REVIEW_REQUIRED');
 assert.ok(!JSON.stringify(db.state()).includes('secret provider reply'));
 await assert.rejects(runBatch(opt),/batch_manual_review_required/);assert.equal(calls,1);
});

test('expired lease with in-flight SMTP operation requires review',async()=>{
 const db=database([],{mode:'SMTP_V1',status:'PROCESSING',sendingIndex:0,leaseUntilMs:0,firstAttemptAtMs:scheduledAt.getTime()});
 assert.equal((await runBatch(options(db))).status,'REVIEW_REQUIRED');
});

test('concurrent invocation cannot duplicate messages',async()=>{
 const db=database([order()]);let calls=0;
 const opt={...options(db),transporter:{sendMail:async mail=>{calls++;await new Promise(r=>setTimeout(r,5));return accepted(mail);}}};
 const result=await Promise.allSettled([runBatch(opt),runBatch(opt)]);
 assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.equal(calls,2);
});

test('legacy processed batches stay processed, pending Resend batches cannot migrate silently',async()=>{
 assert.equal((await runBatch(options(database([],{mode:'LIVE_V1',status:'PROCESSED'})))).status,'ALREADY_PROCESSED');
 await assert.rejects(runBatch(options(database([],{mode:'LIVE_V1',status:'RETRYABLE'}))),/batch_incompatible_existing_batch/);
});

test('cutoff guard and stale retry guard remain active',async()=>{
 await assert.rejects(runBatch({...options(database()),clock:()=>new Date(scheduledAt.getTime()-1)}),/batch_before_cutoff/);
 const db=database([],{mode:'SMTP_V1',status:'RETRYABLE',firstAttemptAtMs:scheduledAt.getTime()-24*3600000});
 assert.equal((await runBatch(options(db))).status,'REVIEW_REQUIRED');
});

test('formatted sender preserved and injection falls back to Workspace sender',async()=>{
 for(const from of ['Alimentari Russo <ordini@send.dos.design>', 'bad\r\nBcc: a@b.com']) {
 const db=database([order()]);await runBatch({...options(db),from});
 assert.ok(db.state().envelopes.every(m=>m.from===(from.startsWith('bad')?`Alimentari Russo <${ADMIN}>`:from)));
 }
});

test('SMTP acceptance must include the sole recipient',async()=>{
 const db=database([order()]);
 await assert.rejects(runBatch({...options(db),transporter:{sendMail:async()=>({accepted:[],rejected:[]})}}),/batch_send_uncertain/);
 assert.equal(db.state().status,'REVIEW_REQUIRED');
});

test('failure persisting SMTP acceptance cannot trigger duplicate retry',async()=>{
 const db=database([order()]), original=db.runTransaction;let calls=0, failSave=true;
 db.runTransaction=fn=>original(tx=>fn({...tx,update:(ref,patch)=>{
   if(patch.acceptedRecipients&&failSave){failSave=false;throw Error('database unavailable');}
   tx.update(ref,patch);
 }}));
 const opt={...options(db),transporter:{sendMail:async mail=>{calls++;return accepted(mail);}}};
 await assert.rejects(runBatch(opt),/batch_send_uncertain/);
 assert.equal(db.state().status,'REVIEW_REQUIRED');
 await assert.rejects(runBatch(opt),/batch_manual_review_required/);assert.equal(calls,1);
});

test('time-budget pause resumes without resending accepted recipients',async()=>{
 const db=database([order()]);let now=scheduledAt,calls=0;
 const opt={...options(db),clock:()=>now,transporter:{sendMail:async mail=>{
   calls++;if(calls===1)now=new Date(scheduledAt.getTime()+61000);return accepted(mail);
 }}};
 await assert.rejects(runBatch(opt),/batch_time_budget/);assert.equal(db.state().status,'RETRYABLE');
 await runBatch(opt);assert.equal(calls,2);assert.equal(db.state().status,'PROCESSED');
});
