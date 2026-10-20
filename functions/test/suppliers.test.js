const {test}=require('node:test');
const assert=require('node:assert/strict');
const suppliers=require('../config/suppliers');
const {windowFor,summarize,envelope}=require('../russo-batch');
const {runReminders,eligible}=require('../draft-reminders');
test('supplier configuration separates cutoff and threshold',()=>{
 const day=new Date('2026-10-20T08:00:00Z');
 assert.equal(windowFor(day,suppliers.russo).cutoff.toISOString(),'2026-10-20T08:30:00.000Z');
 assert.equal(windowFor(day,suppliers.pagnottella).cutoff.toISOString(),'2026-10-20T09:00:00.000Z');
 const summary=summarize([{data:()=>({supplierId:'pagnottella',total:1,email:'a@dos.design',createdAt:day})}],windowFor(day,suppliers.pagnottella),suppliers.pagnottella);
 assert.equal(summary.totalCents,100);
 assert.match(envelope(summary,'2026-10-20',suppliers.pagnottella.fromHeader,'a@dos.design',suppliers.pagnottella).subject,/Confermato Pagnottella/);
});
test('draft eligibility excludes finalized, other suppliers and unconsented carts',()=>{
 const d={supplierId:'russo',day:'2026-10-20',status:'DRAFT',reminderSent:false,items:[{name:'test'}],userEmail:'a@dos.design'};
 assert.equal(eligible(d,'russo',d.day),true);
 for(const patch of [{orderId:'order'},{reminderSent:true},{status:'CONFIRMED'},{supplierId:'pagnottella'},{items:[]},{userEmail:'a@mydos.design'}]) assert.equal(eligible({...d,...patch},'russo',d.day),false);
});
test('reminder is individual and daily-deduplicated',async()=>{
 const now=new Date('2026-10-20T08:05:00Z'),day='2026-10-20';let state=null,calls=0;
 const draft={supplierId:'russo',day,status:'DRAFT',reminderSent:false,items:[{name:'test'}],userEmail:'a@dos.design'};
 const snap=()=>({exists:true,data:()=>draft});
 const ref={get:async()=>snap(),update:async p=>Object.assign(draft,p)};const receipt={update:async p=>{state={...state,...p};}};
 const query={where(){return this;},limit(){return this;},get:async()=>({size:1,docs:[{ref,data:()=>draft}]})};
 const db={collection:()=>query,doc:()=>receipt,runTransaction:async fn=>fn({get:async r=>r===ref?snap():{exists:!!state,data:()=>state},set:(r,v)=>{state=v;}})};
 const opt={db,supplierId:'russo',scheduledAt:now,clock:()=>now,transporter:{sendMail:async mail=>{calls++;assert.deepEqual(mail.to,['a@dos.design']);return {accepted:mail.to};}}};
 await runReminders(opt);await runReminders(opt);assert.equal(calls,1);assert.equal(state.status,'ACCEPTED');
 assert.equal((await runReminders({...opt,clock:()=>new Date('2026-10-20T08:30:00Z')})).status,'OUTSIDE_WINDOW');
});
