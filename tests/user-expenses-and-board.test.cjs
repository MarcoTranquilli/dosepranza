const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(){const values=new Map(),sessionStorage={get length(){return values.size;},key:i=>[...values.keys()][i],getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};const ctx={Intl,Date,Map,Set,sessionStorage};vm.createContext(ctx);for(const file of ['user-expenses','daily-board'])vm.runInContext(fs.readFileSync(`shared/${file}.js`,'utf8'),ctx);return {E:ctx.DoseExpenses,B:ctx.DoseDailyBoard,values};}
const now=new Date('2026-11-10T10:00:00Z');
const row=(patch={})=>({uid:'u',supplierId:'russo',createdAt:new Date('2026-11-10T08:00:00Z'),total:5.35,confirmationStatus:'CONFIRMED',...patch});
test('integer cent aggregation isolates owner and suppliers, excludes cancelled and unconfirmed orders',()=>{
 const {E}=setup(),data=E.aggregate([row(),row({supplierId:'pagnottella',total:2.1}),row({uid:'other'}),row({orderStatus:'cancelled'}),row({confirmationStatus:null,orderStatus:'submitted'}),row({total:NaN})],'u',now);
 assert.equal(data.month.cents,745);assert.equal(data.month.count,2);assert.equal(data.month.averageCents,373);assert.equal(data.month.pagnottella.cents,210);assert.equal(data.pending,1);assert.equal(data.excluded,2);assert.equal(data.malformed,1);
 assert.equal(E.aggregate([],'u',now).month.averageCents,0);
});
test('Rome month and Monday windows cross DST and month boundaries without fixed offsets',()=>{
 const {E}=setup();assert.equal(E.midnight('2026-10-25').toISOString(),'2026-10-24T22:00:00.000Z');assert.equal(E.midnight('2026-10-26').toISOString(),'2026-10-25T23:00:00.000Z');
 const p=E.period(new Date('2026-11-01T12:00:00Z'));assert.equal(p.weekStart.toISOString(),'2026-10-25T23:00:00.000Z');assert.equal(p.monthStart.toISOString(),'2026-10-31T23:00:00.000Z');
 const summary=E.aggregate([row({createdAt:new Date('2026-10-30T12:00:00Z')})],'u',new Date('2026-11-01T12:00:00Z'));assert.equal(summary.month.count,0);assert.equal(summary.week.count,1);
});
test('query is owner constrained, cache expires in 15 minutes, invalidates after order and never crosses UID',async()=>{
 const {E}=setup(),filters=[];let calls=0;
 const sdk={collection:()=>({}),where:(...args)=>{filters.push(args);return{};},orderBy:()=>({}),limit:()=>({}),query:()=>({}),getDocsFromServer:async()=>{calls++;return {size:1,docs:[{data:()=>row()}]};}};
 await E.load({},sdk,'u',now);assert.deepEqual(filters[0],['uid','==','u']);assert.equal((await E.load({},sdk,'u',new Date(+now+899999))).source,'session');assert.equal(calls,1);
 await E.load({},sdk,'u',new Date(+now+900000));assert.equal(calls,2);E.invalidate('u');assert.equal(E.cached('u',now),null);assert.equal(E.cached('other',now),null);
});
test('inflight responses cannot repopulate an invalidated cache',async()=>{
 const {E}=setup();let resolve;const sdk={collection:()=>({}),where:()=>({}),orderBy:()=>({}),limit:()=>({}),query:()=>({}),getDocsFromServer:()=>new Promise(r=>resolve=r)};
 const pending=E.load({},sdk,'u',now);E.invalidate('u');resolve({size:0,docs:[]});await assert.rejects(pending,/aggiornare/);assert.equal(E.cached('u',now),null);
});
test('board payload is minimized and restricted to verified Google DOS identities',()=>{
 const {B}=setup();const user={uid:'u',email:'test@dos.design',displayName:'Test User',emailVerified:true,providerData:[{providerId:'google.com'}]};
 const entry=B.participant(user,'russo','order',{Timestamp:{now:()=>1}});assert.deepEqual(Object.keys(entry).sort(),['email','name','orderId','supplierId','timestamp','uid']);
 for(const patch of [{email:'external@gmail.com'},{emailVerified:false},{isAnonymous:true},{providerData:[]}])assert.equal(B.allowed({...user,...patch}),false);
 assert.equal(B.people([entry,{...entry,supplierId:'pagnottella'},entry]).length,1);
});
test('board transaction deduplicates repeat registrations for the same UID and supplier',async()=>{
 const {B,E}=setup(),user={uid:'u',email:'test@dos.design',displayName:'Test',emailVerified:true,providerData:[{providerId:'google.com'}]};let stored=null,writes=0;
 const sdk={doc:()=>({}),Timestamp:{now:()=>1},serverTimestamp:()=>2,runTransaction:async(db,fn)=>fn({get:async()=>({exists:()=>!!stored,data:()=>stored}),set:(ref,value)=>{stored=value;writes++;}})};
 const event={uid:'u',supplier:'russo',id:'order',day:E.day(),confirmed:true};await B.publish({},sdk,user,event);await B.publish({},sdk,user,event);assert.equal(writes,1);assert.equal(await B.publish({},sdk,user,{...event,uid:'other'}),false);
});
