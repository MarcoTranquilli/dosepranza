(()=>{
try{
  window.DoseSupplierAccess?.resolveSession?.().catch(()=>{});
}catch(e){
  console.warn('Russo guard skipped',e);
}
})();