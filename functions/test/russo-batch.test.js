const {test} = require('node:test');
const assert = require('node:assert/strict');
const {runBatch, windowFor, ADMIN} = require('../russo-batch');
const scheduledAt = new Date('2026-10-19T08:30:00Z');
const order = (overrides = {}) => ({supplierId:'russo', total:10, email:'collega@dos.design',
  createdAt:new Date('2026-10-19T08:00:00Z'), ...overrides});

function database(rows = [], initial = null) {
  let batch = initial, queue = Promise.resolve();
  const conditions = [];
  const query = {where(...args) {conditions.push(args); return this;}, orderBy() {return this;}, limit() {return this;}};
  return {
    doc:path => {assert.equal(path, 'daily_batches/2026-10-19_russo'); return {path};},
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

const options = db => ({db, apiKey:'mock-only', from:'ordini@dos.design', scheduledAt, clock:() => scheduledAt,
  serverTimestamp:() => scheduledAt, fetchImpl:async (url, init) => ({ok:true, json:async () => ({data:JSON.parse(init.body).map((_,i)=>({id:`test-${i}`}))})})});

test('Rome date and cutoff handle summer, winter and DST day', () => {
  assert.equal(windowFor(scheduledAt).cutoff.toISOString(), '2026-10-19T08:30:00.000Z');
  assert.equal(windowFor(new Date('2026-12-07T10:00:00Z')).cutoff.toISOString(), '2026-12-07T09:30:00.000Z');
  const dst = windowFor(new Date('2026-10-25T12:00:00Z'));
  assert.equal(dst.start.toISOString(), '2026-10-24T22:00:00.000Z');
  assert.equal(dst.cutoff.toISOString(), '2026-10-25T09:30:00.000Z');
});

for (const [total, subject] of [[20,'Ordine Confermato Alimentari Russo'],[19.99,'Ordine Russo Non Confermato (soglia minima non raggiunta)'],[0,'Ordine Russo Non Confermato (soglia minima non raggiunta)']]) {
  test(`private recipient payload for total ${total}`, async () => {
    const db = database(total ? [order({total})] : []);
    const opt = options(db);
    let calls = 0;
    opt.fetchImpl = async (url, init) => {
      calls++;
      assert.equal(url, 'https://api.resend.com/emails/batch');
      const messages = JSON.parse(init.body);
      const body = messages.find(m => m.to[0] === ADMIN);
      assert.deepEqual(body.to, [ADMIN]); assert.equal(body.cc, undefined); assert.equal(body.bcc, undefined);
      assert.equal(body.subject, `DOSepranza - ${subject}`);
      assert.equal(body.from, 'ordini@dos.design');
      assert.equal(body.text.includes('collega@dos.design'), false);
      assert.equal(messages.length, total ? 2 : 1);
      assert.ok(messages.every(m => m.to.length === 1 && !m.cc && !m.bcc));
      assert.equal(init.headers['Idempotency-Key'], 'russo-live-v1-2026-10-19-0');
      assert.equal(init.headers.Authorization, 'Bearer mock-only');
      return {ok:true, json:async () => ({data:messages.map((_,i)=>({id:`test-${i}`}))})};
    };
    await runBatch(opt);
    assert.equal(db.state().status, 'PROCESSED'); assert.equal(db.state().total, total);
    assert.deepEqual(db.state().recipients, total ? ['collega@dos.design', ADMIN] : [ADMIN]);
    assert.equal(db.state().processedAt, scheduledAt.toISOString());
    assert.equal((await runBatch(opt)).status, 'ALREADY_PROCESSED'); assert.equal(calls, 1);
  });
}

test('only today Russo pre-cutoff eligible orders contribute, query scoped at source', async () => {
  const db = database([order(), order({supplierId:'pagnottella',total:100}), order({status:'cancelled'}),
    order({orderStatus:'annullato'}), order({isTest:true}), order({orderType:'fridge'}),
    order({createdAt:new Date('2026-10-18T10:00:00Z')}), order({createdAt:scheduledAt})]);
  await runBatch(options(db));
  assert.equal(db.state().total, 10);
  assert.deepEqual(db.conditions[0], ['supplierId','==','russo']);
  assert.equal(db.conditions[1][1], '>='); assert.equal(db.conditions[2][1], '<');
});

test('invalid amount fails before mail; missing secret fails before database', async () => {
  const db = database([order({total:NaN})]);
  await assert.rejects(runBatch(options(db)), /batch_invalid_amount/);
  assert.equal(db.state(), null);
  await assert.rejects(runBatch({...options(null),apiKey:''}), /batch_missing_configuration/);
});

test('missing or invalid sender falls back safely; valid sender is preserved', async () => {
  for (const from of [undefined, null, '', ' ', 'invalid', 'bad@address', 'a@b.com\r\nBcc: x@y.com', ' ordini@dos.design ']) {
    const db = database([order({email:ADMIN})]);
    await runBatch({...options(db), from, fetchImpl:async (url, init) => {
      const [body] = JSON.parse(init.body);
      assert.equal(body.from, from === ' ordini@dos.design ' ? 'ordini@dos.design' : 'onboarding@resend.dev');
      assert.deepEqual(body.to, [ADMIN]);
      assert.equal(init.headers.Authorization, 'Bearer mock-only');
      return {ok:true, json:async () => ({data:[{id:'sender-test'}]})};
    }});
    assert.equal(db.state().status, 'PROCESSED');
  }
});

test('sender fallback never bypasses missing secret validation', async () => {
  for (const apiKey of [undefined, null, '', '   ']) {
    await assert.rejects(runBatch({...options(null), apiKey, from:'invalid'}), /batch_missing_configuration/);
  }
});

test('concurrent invocation cannot send a second email', async () => {
  const db = database([order({total:20})]); let calls = 0;
  const opt = {...options(db), fetchImpl:async () => {calls++; await new Promise(resolve => setTimeout(resolve,10));return {ok:true,json:async()=>({data:[{id:'once-1'},{id:'once-2'}]})};}};
  const results = await Promise.allSettled([runBatch(opt),runBatch(opt)]);
  assert.equal(calls, 1); assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(db.state().status, 'PROCESSED');
});

test('uncertain send retries same frozen payload/key despite order changes', async () => {
  const rows = [order({total:20})], db = database(rows), payloads = [];
  const opt = options(db);
  opt.fetchImpl = async (url, init) => {payloads.push([init.body,init.headers['Idempotency-Key']]);throw new Error('private provider detail');};
  await assert.rejects(runBatch(opt), error => error.message === 'batch_send_uncertain');
  rows.push(order({total:100}));
  opt.fetchImpl = async (url, init) => {payloads.push([init.body,init.headers['Idempotency-Key']]);return {ok:true,json:async()=>({data:[{id:'retry-1'},{id:'retry-2'}]})};};
  await runBatch(opt); assert.deepEqual(payloads[0], payloads[1]);assert.equal(db.state().total,20);
});

test('uncertain batch beyond 23h is held for manual review without sending', async () => {
  const db = database([order()]), opt = options(db);
  opt.fetchImpl = async () => {throw new Error('timeout');};
  await assert.rejects(runBatch(opt));
  opt.clock = () => new Date(scheduledAt.getTime() + 23 * 3600000);
  opt.fetchImpl = async () => {assert.fail('must not send');};
  assert.equal((await runBatch(opt)).status, 'REVIEW_REQUIRED');
});

test('provider error only retains status code, not response body or key', async () => {
  const db = database([order()]);
  await assert.rejects(runBatch({...options(db),fetchImpl:async()=>({ok:false,status:403,text:async()=>{assert.fail('do not read provider error body');}})}), /batch_resend_http_403/);
  assert.equal(db.state().lastError, 'batch_resend_http_403');
  assert.equal(JSON.stringify(db.state()).includes('mock-only'), false);
});

test('invocations before cutoff cannot finalize batch', async () => {
  await assert.rejects(runBatch({...options(database()),clock:()=>new Date('2026-10-19T08:29:59Z')}), /batch_before_cutoff/);
});

for (const total of [5, 10]) {
  test(`multiple orders deduplicate recipients and include admin: unit total ${total}`, async () => {
    const db = database([order({email:' COLLEGA@DOS.DESIGN ',total}), order({total}), order({email:ADMIN,total})]);
    await runBatch(options(db));
    assert.equal(db.state().total, total * 3);
    assert.equal(db.state().ordersCount, 3);
    assert.deepEqual(db.state().recipients, ['collega@dos.design', ADMIN]);
    assert.equal(db.state().deliveryStatus, 'ACCEPTED');
    for (const mail of db.state().envelopes) {
      assert.ok(mail.html.includes(total === 5 ? 'annullati' : 'in preparazione'));
      assert.ok(!mail.html.includes('collega@dos.design'));
    }
  });
}

test('sandbox sender blocks colleague sends before any database write or request', async () => {
  const db = database([order()]);
  await assert.rejects(runBatch({...options(db),from:'onboarding@resend.dev'}), /batch_verified_sender_required/);
  assert.equal(db.state(), null);
});

test('invalid recipient fails closed instead of silently omitting an order owner', async () => {
  await assert.rejects(runBatch(options(database([order({email:'not-an-email'})]))), /batch_invalid_recipient/);
});

test('old processed test batch is not resent; pending test batch requires explicit review', async () => {
  assert.equal((await runBatch(options(database([], {mode:'ADMIN_TEST',status:'PROCESSED'})))).status, 'ALREADY_PROCESSED');
  await assert.rejects(runBatch(options(database([], {mode:'ADMIN_TEST',status:'RETRYABLE'}))), /batch_incompatible_existing_batch/);
});

test('over 100 recipients use stable private chunks; partial failure retries identical payloads', async () => {
  const db = database(Array.from({length:101},(_,i)=>order({email:`user${i}@dos.design`})));
  const payloads = [], keys = [];
  const opt = {...options(db), fetchImpl:async(url,init)=>{
    payloads.push(init.body); keys.push(init.headers['Idempotency-Key']);
    if(payloads.length === 2) throw Error('network');
    return {ok:true,json:async()=>({data:JSON.parse(init.body).map((_,i)=>({id:`id-${i}`}))})};
  }};
  await assert.rejects(runBatch(opt), /batch_send_uncertain/);
  assert.equal(db.state().status, 'RETRYABLE');
  await runBatch(opt);
  assert.deepEqual(payloads.slice(0,2),payloads.slice(2));
  assert.deepEqual(keys.slice(0,2),keys.slice(2));
  assert.equal(JSON.parse(payloads[0]).length,100);
  assert.equal(JSON.parse(payloads[1]).length,2);
  assert.equal(db.state().recipients.length,102);
});

test('incomplete provider response never marks batch processed', async () => {
  const db=database([order()]);
  await assert.rejects(runBatch({...options(db),fetchImpl:async()=>({ok:true,json:async()=>({data:[]})})}), /batch_invalid_provider_response/);
  assert.equal(db.state().status,'RETRYABLE');
});
