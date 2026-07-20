(()=>{
try{
 const u=JSON.parse(localStorage.getItem('dose_user')||'null');
 const email=String(u&&u.email||'').trim().toLowerCase();
 const provider=String(u&&u.provider||'').trim().toLowerCase();
 const staff=email==='marco.tranquilli@dos.design'||email==='russolorenzo11@gmail.com'||email==='lorenzo.russo@alimentarirusso'||email==='beatrice.binini@dos.design'||email==='monica.porta@dos.design';
 if(staff&&provider!=='google.com'){
  localStorage.removeItem('dose_user');
  localStorage.removeItem('menu_admin_open');
  location.replace('./login-google-final.html?next=russo&v=pages-auth-fix-1');
  return;
 }
 window.DoseSupplierAccess?.resolveSession?.().catch(()=>{});
}catch(e){console.warn('Russo guard skipped',e)}
})();