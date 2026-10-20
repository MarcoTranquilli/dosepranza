// Draft writes never authorize an order or replace checkout authentication.
(() => {
  const timers = new Map(), generations = new Map(), finalizing = new Set();
  let queue = Promise.resolve();
  const romeDay = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  async function context() {
    const [{getApps},{getAuth}, sdk] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js')]);
    const app = getApps().find(a=>a.name==='[DEFAULT]');
    if (!app) return null;
    const auth = getAuth(app), user = auth.currentUser;
    if (!user || user.isAnonymous || !user.emailVerified || !user.email?.toLowerCase().endsWith('@dos.design')) return null;
    return {sdk, db:sdk.getFirestore(app), auth, user};
  }
  function sync(supplierId, items, totalCents, final = false) {
    if (!['russo','pagnottella'].includes(supplierId) || (!final && finalizing.has(supplierId))) return Promise.resolve();
    if (final) finalizing.add(supplierId);
    clearTimeout(timers.get(supplierId));
    const generation = (generations.get(supplierId)||0)+1;
    generations.set(supplierId,generation);
    const captured = context();
    const day = romeDay();
    const clean = items.map(i=>({name:String(i.name||'').slice(0,200),qty:Number(i.qty||1)}));
    const write = () => {
      queue = queue.catch(()=>{}).then(async()=>{
        const c = await captured;
        if (!c || c.auth.currentUser?.uid !== c.user.uid || romeDay() !== day || generations.get(supplierId)!==generation) return;
        const {sdk,db,user}=c;
        const ref=sdk.doc(db,'drafts',`${supplierId}_${user.uid}_${day}`);
        await sdk.runTransaction(db,async tx=>{
          const old=await tx.get(ref);
          if(c.auth.currentUser?.uid!==user.uid) return;
          // Finalization must not be undone by the subsequent empty-cart render.
          if(!final && old.exists() && old.data().status==='CONFIRMED') return;
          tx.set(ref,{userId:user.uid,userEmail:user.email,supplierId,day,items:clean,
            totalCents:Math.max(0,Math.round(totalCents)),status:final?'CONFIRMED':clean.length?'DRAFT':'CANCELLED',
            ...(old.exists()?{}:{reminderSent:false}),updatedAt:sdk.serverTimestamp()}, {merge:true});
        });
      });
      return queue.catch(()=>{console.warn('draft_sync_failed');window.dispatchEvent(new Event('dose-draft-sync-error'));});
    };
    if(final) return write();
    timers.set(supplierId,setTimeout(write,1000));
    return Promise.resolve();
  }
  window.DoseCartSync={sync,confirm:(supplierId)=>sync(supplierId,[],0,true)};
})();
