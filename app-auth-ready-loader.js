(async()=>{
  try{
    await new Promise(resolve=>setTimeout(resolve,3500));
  }catch(e){
    console.warn('Auth ready wait skipped',e);
  }
  await import('./app.v20260325.js?v=pages-auth-fix-2');
})();