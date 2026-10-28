const suppliers = require('../config/suppliers');
const formatter = new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Rome',
  year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'});
function parts(date) {
  return Object.fromEntries(formatter.formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
}
function dayOf(date) { const p=parts(date); return `${p.year}-${p.month}-${p.day}`; }
function shift(day, n) { return new Date(Date.parse(`${day}T12:00:00Z`)+n*86400000).toISOString().slice(0,10); }
function midnight(day) {
  const target=Date.parse(`${day}T00:00:00Z`);
  let value=target;
  for(let i=0;i<5;i++) {
    const p=parts(new Date(value));
    const represented=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);
    if(represented===target) return new Date(value);
    value+=target-represented;
  }
  throw new Error('digest_invalid_midnight');
}
function windowFor(now=new Date(), mode='30days') {
  if(!['30days','week'].includes(mode)) throw new Error('digest_invalid_period');
  let endDay=dayOf(now), startDay;
  if(mode==='week') {
    const weekday=new Date(`${endDay}T12:00:00Z`).getUTCDay();
    endDay=shift(endDay,-((weekday+6)%7)); startDay=shift(endDay,-7);
  } else startDay=shift(endDay,-30);
  return {startDay,endDay,start:midnight(startDay),end:midnight(endDay),mode};
}
function dateOf(v) { try { const d=v?.toDate ? v.toDate() : new Date(v); return v!=null && Number.isFinite(d.getTime())?d:null; } catch { return null; } }
function money(v) { const c=Math.round(v*100); return typeof v==='number' && Number.isSafeInteger(c) && c>=0 && Math.abs(v*100-c)<0.00001 ? c:null; }
function blank() { return {orders:0,revenueCents:0,units:0,users:new Map(),attempts:new Set(),converted:new Set(),
  products:new Map(),categories:new Map(),hourly:Array(24).fill(0),weekdays:Array(7).fill(0),postCutoff:0}; }
function rank(map) { return [...map.values()].sort((a,b)=>b.revenueCents-a.revenueCents || b.quantity-a.quantity || a.name.localeCompare(b.name)); }
function finish(s, topN) {
  const activeUsers=s.users.size;
  return {orders:s.orders,revenueCents:s.revenueCents,units:s.units,activeUsers,
    started:s.attempts.size,convertedAttempts:s.converted.size,
    conversionPct:s.attempts.size?100*s.converted.size/s.attempts.size:0,
    aovCents:s.orders?s.revenueCents/s.orders:0,itemsPerOrder:s.orders?s.units/s.orders:0,
    spendPerUserCents:activeUsers?s.revenueCents/activeUsers:0,ordersPerUser:activeUsers?s.orders/activeUsers:0,
    hourly:s.hourly,weekdays:s.weekdays,postCutoff:s.postCutoff,
    topByRevenue:rank(s.products).slice(0,topN),
    topByQuantity:rank(s.products).sort((a,b)=>b.quantity-a.quantity||b.revenueCents-a.revenueCents).slice(0,topN),
    categories:rank(s.categories),topUsers:[...s.users.values()].sort((a,b)=>b.revenueCents-a.revenueCents||b.orders-a.orders).slice(0,5)
      .map(u=>({...u,aovCents:u.revenueCents/u.orders}))};
}
function calculate(orders,drafts,window,topN=5) {
  if(![5,10].includes(topN)) throw new Error('digest_invalid_top');
  const buckets=Object.fromEntries(Object.keys(suppliers).map(id=>[id,blank()]));
  const all=blank(), diagnostics={malformedOrders:0,malformedDrafts:0,excludedOrders:0,unknownSupplier:0,unmatchedConfirmedDrafts:0,productTotalMismatch:0};
  const excluded=/^(cancelled|canceled|annullato|annullata|draft|bozza|void|refunded|not_confirmed)$/i;
  // UID is canonical; email aliases reconcile historical orders that only stored email.
  const aliases=new Map();
  for(const o of [...orders,...drafts]) { const uid=o.userId||o.uid, email=o.userEmail||o.email;
    if(typeof uid==='string'&&uid&&typeof email==='string'&&email) aliases.set(email.trim().toLowerCase(),uid); }
  function identity(o) { const uid=o.userId||o.uid, email=o.userEmail||o.email;
    return typeof uid==='string'&&uid?uid:typeof email==='string'&&email.trim()?(aliases.get(email.trim().toLowerCase())||email.trim().toLowerCase()):null; }
  for(const o of orders) {
    if(!buckets[o.supplierId]) {diagnostics.unknownSupplier++;continue;}
    if(o.isTest||o.test||o.e2e||(o.orderType&&o.orderType!=='order')||[o.status,o.orderStatus,o.paymentStatus,o.confirmationStatus].some(s=>excluded.test(s||''))) {diagnostics.excludedOrders++;continue;}
    const date=dateOf(o.createdAt), uid=identity(o), cents=money(o.totalAmount ?? o.total);
    const items=Array.isArray(o.items)?o.items.map(i=>({name:typeof i?.name==='string'?i.name.trim():'',
      quantity:i?.quantity??i?.qty??1,price:money(i?.price),category:String(i?.category||i?.cat||'Non classificato')})):[];
    if(!date||!uid||cents===null||!items.length||items.some(i=>!i.name||!Number.isSafeInteger(i.quantity)||i.quantity<=0||i.price===null||!Number.isSafeInteger(i.price*i.quantity))) {diagnostics.malformedOrders++;continue;}
    if(date<window.start||date>=window.end) continue;
    const day=dayOf(date), key=JSON.stringify([o.supplierId,uid,day]);
    const p=parts(date), weekday=(new Date(`${day}T12:00:00Z`).getUTCDay()+6)%7;
    const cutoff=suppliers[o.supplierId].cutoffTimeRome;
    if(items.reduce((n,i)=>n+i.price*i.quantity,0)!==cents) diagnostics.productTotalMismatch++;
    for(const s of [buckets[o.supplierId],all]) {
      s.orders++;s.revenueCents+=cents;s.units+=items.reduce((n,i)=>n+i.quantity,0);
      if(!Number.isSafeInteger(s.revenueCents)||!Number.isSafeInteger(s.units)) throw new Error('digest_overflow');
      s.attempts.add(key);s.converted.add(key);s.hourly[+p.hour]++;s.weekdays[weekday]++;
      if(`${p.hour}:${p.minute}`>=cutoff) s.postCutoff++;
      const u=s.users.get(uid)||{name:String(o.userEmail||o.email||uid),orders:0,revenueCents:0};
      u.orders++;u.revenueCents+=cents;s.users.set(uid,u);
      for(const i of items) for(const [map,name] of [[s.products,i.name],[s.categories,i.category]]) {
        const v=map.get(name)||{name,quantity:0,revenueCents:0};v.quantity+=i.quantity;v.revenueCents+=i.quantity*i.price;map.set(name,v);
      }
    }
  }
  for(const d of drafts) {
    if(!buckets[d.supplierId]) {diagnostics.unknownSupplier++;continue;}
    const uid=identity(d), day=d.day;
    if(!uid||typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(`${day}T00:00:00Z`))||new Date(`${day}T00:00:00Z`).toISOString().slice(0,10)!==day||!['DRAFT','CONFIRMED','CANCELLED','EMPTY'].includes(d.status)) {diagnostics.malformedDrafts++;continue;}
    if(day<window.startDay||day>=window.endDay||d.isTest||d.test||d.e2e) continue;
    const key=JSON.stringify([d.supplierId,uid,day]);
    for(const s of [buckets[d.supplierId],all]) s.attempts.add(key);
    if(d.status==='CONFIRMED'&&!buckets[d.supplierId].converted.has(key)) diagnostics.unmatchedConfirmedDrafts++;
  }
  return {window,overall:finish(all,topN),suppliers:Object.fromEntries(Object.entries(buckets).map(([id,s])=>[id,finish(s,topN)])),diagnostics};
}
module.exports={windowFor,midnight,dayOf,calculate};
