const {test}=require('node:test');
const assert=require('node:assert/strict');
const {calculate,windowFor,midnight}=require('../analytics/digest-calculator');
const {renderDigest}=require('../analytics/digest-email');
const {runDigest,readPagewise}=require('../analytics/admin-digest');
const window=windowFor(new Date('2026-10-27T12:00:00Z'));
const order=(overrides={})=>({supplierId:'russo',userId:'u1',userEmail:'u1@example.test',createdAt:new Date('2026-10-26T08:00:00Z'),totalAmount:10,items:[{name:'Panino',price:5,quantity:2,category:'Panini'}],...overrides});
test('zero orders: finite metrics and both suppliers',()=>{
 const r=calculate([],[],window);for(const s of Object.values(r.suppliers)) {assert.equal(s.orders,0);assert.equal(s.aovCents,0);assert.equal(s.conversionPct,0);}assert.match(renderDigest(r).text,/Pagnottella/);
});
test('one order: means, Rome hour and Monday',()=>{
 const s=calculate([order()],[],window).suppliers.russo;
 assert.equal(s.aovCents,1000);assert.equal(s.itemsPerOrder,2);assert.equal(s.spendPerUserCents,1000);assert.equal(s.ordersPerUser,1);assert.equal(s.hourly[9],1);assert.equal(s.weekdays[0],1);assert.equal(s.conversionPct,100);
});
test('N orders: no double counting converted drafts; segmentation and unique active users',()=>{
 const r=calculate([order(),order(),order({supplierId:'pagnottella',totalAmount:20})],[{supplierId:'russo',userId:'u1',day:'2026-10-26',status:'CONFIRMED'},{supplierId:'russo',userId:'u2',day:'2026-10-26',status:'DRAFT'}],window);
 assert.equal(r.suppliers.russo.orders,2);assert.equal(r.suppliers.russo.started,2);assert.equal(r.suppliers.russo.conversionPct,50);assert.equal(r.suppliers.russo.ordersPerUser,2);assert.equal(r.suppliers.pagnottella.orders,1);assert.equal(r.overall.activeUsers,1);assert.equal(r.overall.revenueCents,4000);
});
test('legacy schema aliases total uid email qty cat and email-only draft',()=>{
 const o=order({userId:undefined,userEmail:undefined,uid:'u1',email:'u1@example.test',totalAmount:undefined,total:10,items:[{name:'Panino',price:5,qty:2,cat:'Panini'}]});
 const r=calculate([o],[{supplierId:'russo',userEmail:'u1@example.test',day:'2026-10-26',status:'CONFIRMED'}],window);
 assert.equal(r.suppliers.russo.started,1);assert.equal(r.suppliers.russo.categories[0].quantity,2);
});
test('DST Rome: 25 and 23 hour days, week Monday/Sunday and exclusive end',()=>{
 assert.equal((midnight('2026-10-26')-midnight('2026-10-25'))/3600000,25);
 assert.equal((midnight('2026-03-30')-midnight('2026-03-29'))/3600000,23);
 const w=windowFor(new Date('2026-10-27T12:00:00Z'),'week');assert.equal(w.startDay,'2026-10-19');assert.equal(w.endDay,'2026-10-26');
 assert.equal(calculate([order({createdAt:w.start}),order({createdAt:w.end})],[],w).overall.orders,1);
});
test('summer/winter hours, cutoff inclusive and weekend retained',()=>{
 const w=windowFor(new Date('2026-10-27T12:00:00Z'));
 const r=calculate([order({createdAt:new Date('2026-10-23T08:30:00Z')}),order({createdAt:new Date('2026-10-26T09:30:00Z')}),order({createdAt:new Date('2026-10-25T08:00:00Z')})],[],w).suppliers.russo;
 assert.equal(r.hourly[10],2);assert.equal(r.postCutoff,2);assert.equal(r.weekdays[6],1);
});
test('malformed and cancelled records excluded with aggregate diagnostics',()=>{
 const r=calculate([order({totalAmount:NaN}),order({items:[{name:'Bad',price:-1}]}),order({status:'CANCELLED'}),order({supplierId:'unknown'})],[{supplierId:'russo',day:'2026-02-30',userId:'u1',status:'DRAFT'}],window);
 assert.equal(r.overall.orders,0);assert.equal(r.diagnostics.malformedOrders,2);assert.equal(r.diagnostics.malformedDrafts,1);assert.equal(r.diagnostics.excludedOrders,1);assert.equal(r.diagnostics.unknownSupplier,1);
});
test('rank quantities and revenue; escaped HTML and plain text',()=>{
 const r=calculate([order({userEmail:'<script>@example.test',items:[{name:'<img>',price:10,quantity:1}]})],[],window);
 const mail=renderDigest(r);assert.ok(!mail.html.includes('<script>'));assert.ok(mail.html.includes('&lt;img&gt;'));assert.match(mail.text,/Conversione stimata/);assert.equal(r.suppliers.russo.topByRevenue[0].revenueCents,1000);
});
function fixture() {
 let ledger;const messages=[];const writes=[];
 const ref={update:async patch=>{ledger={...ledger,...patch};writes.push('admin_digest_runs');}};
 const db={collection:name=>{
   if(name==='admin_digest_runs')return {doc:()=>ref};
   assert.ok(['orders','drafts'].includes(name));
   const q={where:()=>q,orderBy:()=>q,limit:()=>q,get:async()=>({docs:name==='orders'?[{data:()=>order()}]:[]})};return q;
 },runTransaction:async f=>f({get:async()=>({exists:!!ledger}),create:(_,data)=>{ledger=data;writes.push('admin_digest_runs');}})};
 const transporter={sendMail:async mail=>{messages.push(mail);return {accepted:[mail.to]};}};
 return {db,transporter,messages,writes,state:()=>ledger};
}
test('one admin email, source collections read only and duplicate blocked',async()=>{
 const f=fixture(),args={...f,from:'DOSepranza <admin@example.test>',now:new Date('2026-10-27T12:00:00Z')};
 assert.equal((await runDigest(args)).status,'ACCEPTED');assert.equal((await runDigest(args)).status,'SKIPPED_EXISTING');assert.equal(f.messages.length,1);assert.equal(f.messages[0].to,'marco.tranquilli@dos.design');assert.equal(f.messages[0].bcc,undefined);assert.ok(f.writes.every(x=>x==='admin_digest_runs'));
});
test('SMTP ambiguity requires review, never automatic resend',async()=>{
 const f=fixture();let attempts=0;f.transporter.sendMail=async()=>{attempts++;throw new Error('sensitive SMTP response');};
 const args={...f,from:'admin@example.test',now:new Date('2026-10-27T12:00:00Z')};
 await assert.rejects(runDigest(args),/digest_review_required/);assert.equal(f.state().status,'REVIEW_REQUIRED');await runDigest(args);assert.equal(attempts,1);
});
test('recipient list injection rejected',async()=>{const f=fixture();await assert.rejects(runDigest({...f,from:'admin@example.test',recipient:'a@example.test,b@example.test'}),/digest_invalid_config/);assert.equal(f.messages.length,0);});
test('pagination does not truncate at 500 records',async()=>{
 let page=0;const q={startAfter:()=>{page++;return q;},limit:()=>q,get:async()=>({docs:Array.from({length:page?2:500},(_,i)=>({data:()=>({i})}))})};assert.equal((await readPagewise(q)).length,502);
});
test('corporate report: readable inclusive dates, executive comparison and diagnostics',()=>{
 const mail=renderDigest(calculate([order()],[],window),new Date('2026-10-27T12:00:00Z'));
 assert.match(mail.subject,/26 ottobre 2026/);
 assert.match(mail.text,/Confronto fornitori/);
 assert.match(mail.text,/Valore ordinato/);
 assert.match(mail.text,/Ordini malformati esclusi/);
 assert.match(mail.html,/role="presentation"/);
 assert.ok(!mail.html.includes('00:00–01:00'));
 assert.match(mail.text,/Fine UTC esclusa/);
});
test('Pagnottella-only email excludes Russo users, products, totals and diagnostics',()=>{
 const {supplierDigest}=require('../analytics/supplier-digest');
 const orders=[order({userEmail:'russo-only@example.test',items:[{name:'RUSSO_SECRET_ITEM',price:5,quantity:2}]}),order({totalAmount:NaN}),order({supplierId:'pagnottella',userId:'pg1',userEmail:'pg@example.test'})];
 const {report,mail}=supplierDigest(orders,[{supplierId:'russo',day:'invalid'}],window);
 assert.equal(report.overall.orders,1);assert.equal(report.overall.revenueCents,1000);
 assert.equal(report.diagnostics.malformedOrders,0);assert.equal(report.diagnostics.malformedDrafts,0);
 assert.deepEqual(Object.keys(report.suppliers),['pagnottella']);
 for(const value of [mail.html,mail.text,mail.subject]) {assert.doesNotMatch(value,/Russo|RUSSO_SECRET_ITEM|russo-only|Confronto fornitori/);assert.match(value,/Pagnottella/);}
 assert.equal(calculate(orders,[],window).overall.orders,2);
});
test('Pagnottella-only zero orders and invalid supplier',()=>{
 const {supplierDigest}=require('../analytics/supplier-digest');
 assert.equal(supplierDigest([order()],[],window).report.overall.orders,0);
 assert.throws(()=>supplierDigest([],[],window,'invalid'),/invalid_supplier/);
});
