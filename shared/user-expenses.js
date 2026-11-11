(function(root) {
  'use strict';
  const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  const parts=date=>Object.fromEntries(formatter.formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  const day=(date=new Date())=>{const p=parts(date);return `${p.year}-${p.month}-${p.day}`;};
  function midnight(date){
    const target=Date.parse(date+'T00:00:00Z');let value=target;
    if(!Number.isFinite(target)||new Date(target).toISOString().slice(0,10)!==date)throw Error('Data non valida');
    for(let i=0;i<5;i++){const p=parts(new Date(value));const civil=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);if(civil===target)return new Date(value);value+=target-civil;}
    throw Error('Mezzanotte non risolta');
  }
  const shift=(date,days)=>new Date(Date.parse(date+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);
  function period(now=new Date()){
    const today=day(now),month=today.slice(0,7),monthDay=month+'-01';
    const weekday=new Date(today+'T12:00:00Z').getUTCDay(),weekDay=shift(today,-((weekday+6)%7));
    return {today,month,monthStart:midnight(monthDay),weekStart:midnight(weekDay),start:midnight(weekDay<monthDay?weekDay:monthDay),end:midnight(shift(today,1))};
  }
  function cents(value){if(typeof value!=='number'||!Number.isFinite(value)||value<0)return null;const n=Math.round((value+Number.EPSILON)*100);return Number.isSafeInteger(n)?n:null;}
  const blank=()=>({cents:0,count:0,averageCents:0,russo:{cents:0,count:0},pagnottella:{cents:0,count:0}});
  function aggregate(rows,uid,now=new Date()){
    const range=period(now),result={month:blank(),week:blank(),pending:0,excluded:0,malformed:0};
    const excluded=/^(cancelled|canceled|annullato|void|draft|bozza|refunded|stornato|not_confirmed|rejected)$/i;
    for(const row of rows){
      if(row.uid!==uid){result.excluded++;continue;}
      if(row.isTest===true||row.test===true||row.environment==='test'||[row.status,row.orderStatus,row.paymentStatus,row.confirmationStatus].some(s=>excluded.test(s||''))){result.excluded++;continue;}
      const supplier=row.supplierId==='pagnottella-gourmet'?'pagnottella':row.supplierId;
      const date=row.createdAt?.toDate?.()||new Date(row.createdAt);
      const amount=cents(row.total??row.totalAmount);
      if(!['russo','pagnottella'].includes(supplier)||!Number.isFinite(date.getTime())||date>now||amount===null){result.malformed++;continue;}
      if(date<range.start||date>=range.end)continue;
      // A submitted order is not a supplier/batch confirmation or proof of payment.
      if(![row.confirmationStatus,row.orderStatus,row.status].some(s=>String(s||'').toUpperCase()==='CONFIRMED')){result.pending++;continue;}
      for(const [key,start] of [['month',range.monthStart],['week',range.weekStart]])if(date>=start){
        const bucket=result[key];if(!Number.isSafeInteger(bucket.cents+amount))throw Error('Totale oltre il limite di precisione');
        bucket.cents+=amount;bucket.count++;bucket[supplier].cents+=amount;bucket[supplier].count++;
      }
    }
    for(const bucket of [result.month,result.week])bucket.averageCents=bucket.count?Math.round(bucket.cents/bucket.count):0;
    return result;
  }
  const key=(uid,month)=>`dosepranza_expenses_${uid}_${month}`;
  const revisions=new Map();
  function invalidate(uid){
    if(!uid)return;revisions.set(uid,(revisions.get(uid)||0)+1);
    try{for(let i=sessionStorage.length-1;i>=0;i--){const name=sessionStorage.key(i);if(name?.startsWith(`dosepranza_expenses_${uid}_`))sessionStorage.removeItem(name);}}catch{}
  }
  function cached(uid,now=new Date()){
    try{const p=period(now),value=JSON.parse(sessionStorage.getItem(key(uid,p.month))||'null');
      return value?.version===1&&value.uid===uid&&value.day===p.today&&Number.isFinite(value.savedAt)&&value.savedAt<=now.getTime()&&now.getTime()-value.savedAt<900000&&value.data?.month&&value.data?.week?value.data:null;
    }catch{return null;}
  }
  async function load(db,sdk,uid,now=new Date()){
    if(!uid)throw Error('Autenticazione richiesta');
    const cache=cached(uid,now);if(cache)return {data:cache,source:'session'};
    const range=period(now),revision=revisions.get(uid)||0;
    const request=sdk.query(sdk.collection(db,'orders'),sdk.where('uid','==',uid),sdk.where('createdAt','>=',range.start),sdk.where('createdAt','<',range.end),sdk.orderBy('createdAt','desc'),sdk.limit(2001));
    const snap=await sdk.getDocsFromServer(request);if(snap.size>2000)throw Error('Troppi ordini: riepilogo non calcolato parzialmente');
    const data=aggregate(snap.docs.map(doc=>doc.data()),uid,now);
    if(revision!==(revisions.get(uid)||0))throw Error('Riepilogo da aggiornare dopo il nuovo ordine');
    try{sessionStorage.setItem(key(uid,range.month),JSON.stringify({version:1,uid,day:range.today,savedAt:now.getTime(),data}));}catch{}
    return {data,source:'server'};
  }
  root.DoseExpenses={day,midnight,period,cents,aggregate,load,cached,invalidate};
})(typeof window==='undefined'?globalThis:window);
