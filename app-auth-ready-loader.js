(async()=>{
  try{
    if(window.DoseSupplierAccess?.resolveSession){
      await window.DoseSupplierAccess.resolveSession().catch(()=>null);
    }
  }catch(e){
    console.warn('Auth ready wait skipped',e);
  }
  await import('./app.v20260325.js?v=auth-ready-1');
})();
