(function(root){
  'use strict';
  const allowed=user=>!!user&&!user.isAnonymous&&user.emailVerified===true&&/^[^\s@]+@dos\.design$/.test(user.email||'')&&user.providerData?.some(p=>p.providerId==='google.com');
  function participant(user,supplierId,orderId,sdk){
    if(!allowed(user)||!['russo','pagnottella'].includes(supplierId)||typeof orderId!=='string'||!orderId||orderId.includes('/'))throw Error('Presenza non valida');
    return {uid:user.uid,name:user.displayName||user.email.split('@')[0],email:user.email,supplierId,orderId,timestamp:sdk.Timestamp.now()};
  }
  async function publish(db,sdk,user,event){
    if(!allowed(user)||user.uid!==event.uid||!event.confirmed)return false;
    const day=root.DoseExpenses.day();if(event.day!==day)return false;
    const ref=sdk.doc(db,'daily_summaries',day),entry=participant(user,event.supplier,event.id,sdk);
    return sdk.runTransaction(db,async transaction=>{
      const snapshot=await transaction.get(ref),participants=snapshot.exists()?snapshot.data().participants:[];
      if(!Array.isArray(participants)||participants.length>=300)throw Error('Bacheca non disponibile');
      if(participants.some(p=>p.uid===user.uid&&p.supplierId===entry.supplierId))return false;
      transaction.set(ref,{participants:[...participants,entry],lastUpdated:sdk.serverTimestamp()});return true;
    });
  }
  function people(participants){
    const users=new Map();for(const p of participants||[]){if(!p||typeof p.uid!=='string'||typeof p.name!=='string'||!['russo','pagnottella'].includes(p.supplierId))continue;
      const person=users.get(p.uid)||{uid:p.uid,name:p.name,suppliers:[]};if(!person.suppliers.includes(p.supplierId))person.suppliers.push(p.supplierId);users.set(p.uid,person);}
    return [...users.values()].sort((a,b)=>a.name.localeCompare(b.name,'it'));
  }
  root.DoseDailyBoard={allowed,participant,publish,people};
})(typeof window==='undefined'?globalThis:window);
