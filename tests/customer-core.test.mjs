import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../shared/customer-core.js';
const C=globalThis.DoseCustomerCore;
test('coordinators only; no fake domains',()=>{for(const e of ['marta.diamantini@dos.design','luca.pacella@dos.design','marco.tranquilli@dos.design'])assert.ok(C.manager(e));assert.ok(!C.manager('other@dos.design'));assert.ok(!C.manager('marta.diamantini@dos.design.fake'));});
test('Rome DST day lengths and cutoff',()=>{for(const [day,hours] of [['2026-10-25',25],['2026-03-29',23]]){const r=C.range(day);assert.equal((r.end-r.start)/3600000,hours);}assert.ok(C.open('russo',new Date('2026-10-27T09:29:59Z')));assert.ok(!C.open('russo',new Date('2026-10-27T09:30:00Z')));assert.ok(C.open('pagnottella',new Date('2026-10-27T09:31:00Z')));assert.ok(C.open('pagnottella',new Date('2026-10-27T10:00:00Z')));});
test('reorder uses catalog price; rejects unavailable and invalid quantities',()=>{const p={id:'a',price:8};assert.equal(C.reconcile([{id:'a',price:1,qty:2}],[p])[0].product.price,8);assert.throws(()=>C.reconcile([{id:'x'}],[p]));assert.throws(()=>C.reconcile([{id:'a',qty:0}],[p]));assert.throws(()=>C.reconcile([{id:'a'}],[{...p,available:false}]));});
