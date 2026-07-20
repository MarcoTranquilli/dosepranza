(async()=>{
  try{
    await new Promise(resolve=>setTimeout(resolve,700));
  }catch(e){
    console.warn('Auth ready wait skipped',e);
  }
  await import('./app.v20260325.js?v=pages-stable-1');
})();