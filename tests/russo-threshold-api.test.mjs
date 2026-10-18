import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../netlify/functions/russo-threshold.mjs';
const now = new Date('2026-10-19T08:29:00Z');
function runtime({email='utente@dos.design', provider='google.com', size=1, fail=false} = {}) {
  const query = {where(field, op, value) { if(field==='supplierId') assert.equal(value,'russo'); return this; }, orderBy() {return this;}, limit(value) {assert.equal(value,1001); return this;},
    async get() {return {size,docs:[{id:'synthetic',data:()=>({uid:'private-uid',email:'private@example.invalid',supplierId:'russo',total:15.5,createdAt:'2026-10-19T08:00:00Z'})}]};}};
  return () => ({auth:{verifyIdToken:async(token, revoked) => {assert.equal(token,'synthetic');assert.equal(revoked,true);if(fail)throw Error('revoked');return {email,firebase:{sign_in_provider:provider}};}}, db:{collection:() => query}});
}
const request = (patch={}) => new Request('https://app-dosepranza.netlify.app/.netlify/functions/russo-threshold', {headers:{origin:'https://marcotranquilli.github.io',authorization:'Bearer synthetic'},...patch});
test('aggregate response contains no identity or orders and only Russo total', async () => {
  const response = await createHandler({runtime:runtime(),clock:()=>now})(request());
  const body = await response.json(); assert.equal(response.status,200);assert.equal(body.totalCents,1550);assert.equal(body.missingCents,450);
  assert.equal(body.status,'STATO_IN_ATTESA');assert.equal(response.headers.get('Cache-Control'),'no-store');
  assert.equal(JSON.stringify(body).includes('private'),false);assert.equal('orders' in body,false);
});
test('foreign domains, non-Google sessions, revoked tokens and origins are rejected', async () => {
  for(const email of ['utente@mydos.design','utente@dos.design.fake','test@gmail.com']) assert.equal((await createHandler({runtime:runtime({email})})(request())).status,403);
  assert.equal((await createHandler({runtime:runtime({provider:'anonymous'})})(request())).status,403);
  assert.equal((await createHandler({runtime:runtime({fail:true})})(request())).status,401);
  assert.equal((await createHandler({runtime:runtime()})(request({headers:{origin:'https://evil.invalid'}}))).status,403);
});
test('missing config and query limits fail closed; API method and auth enforced', async () => {
  const missing = createHandler({runtime:()=>{throw Error('configuration missing');}});
  assert.equal((await missing(request())).status,503);
  assert.equal((await createHandler({runtime:runtime({size:1001})})(request())).status,503);
  assert.equal((await missing(request({method:'POST'}))).status,405);
  assert.equal((await missing(request({headers:{}}))).status,401);
  assert.equal((await missing(request({method:'OPTIONS'}))).status,204);
});
test('normalization permits DOS and admin without relying on a client supplied role', async () => {
  for(const email of [' MARCO.TRANQUILLI@DOS.DESIGN ',' utente@DOS.DESIGN ']) assert.equal((await createHandler({runtime:runtime({email}),clock:()=>now})(request())).status,200);
});
