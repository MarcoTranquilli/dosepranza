import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
await import('../pagnottella-gourmet/order-analytics.js');
const window = {DoseOrderAnalytics:globalThis.DoseOrderAnalytics, addEventListener(){}};
vm.runInNewContext(fs.readFileSync(new URL('../russo/threshold-status.js',import.meta.url),'utf8'), {
  window,document:{addEventListener(){}},setInterval(){},Map,Date,Intl,Number,Error
});
const read = window.DoseRussoThreshold.read;
const now = new Date('2026-10-19T08:20:00Z');
function sdk({size=2,error}={}) {
  const constraints=[];
  return {constraints,collection:(db,name)=>{assert.equal(name,'orders');return{};},
    where:(...args)=>{constraints.push(args);return{};},orderBy:()=>({}),limit:value=>{assert.equal(value,1001);return{};},query:()=>({}),
    getDocsFromServer:async()=>{if(error)throw error;return{size,docs:[9,11].map((total,id)=>({id:String(id),data:()=>({supplierId:'russo',total,createdAt:'2026-10-19T08:00:00Z'})}))};}};
}
test('client computes collective sum from server snapshot, with supplier and Rome day query',async()=>{
  const mock=sdk();const result=await read({}, {sdk:mock,now});
  assert.equal(result.status,'STATO_CONFERMATO');assert.equal(result.totalCents,2000);
  assert.deepEqual(mock.constraints[0],['supplierId','==','russo']);
  assert.equal(mock.constraints[1][2].toISOString(),'2026-10-18T22:00:00.000Z');
  assert.equal(mock.constraints[2][2].toISOString(),'2026-10-19T08:30:00.000Z');
});
test('permission error is propagated, never interpreted as empty or confirmed orders',async()=>{
  await assert.rejects(read({}, {sdk:sdk({error:new Error('permission-denied')}),now}),/permission-denied/);
});
test('truncated collective query fails closed',async()=>{
  await assert.rejects(read({}, {sdk:sdk({size:1001}),now}),/summary_limit/);
});
test('uninitialized Firestore never creates another app or anonymous session',async()=>{
  await assert.rejects(read(null,{now}),/firestore_unavailable/);
});
