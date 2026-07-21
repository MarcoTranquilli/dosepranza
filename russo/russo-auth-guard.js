(()=>{
try{
  window.__DOSE_RUSSO_PUBLIC__=true;
  document.addEventListener('click',(event)=>{
    const target=event.target&&event.target.closest('[data-action="save-user"]');
    if(!target||location.hostname!=='marcotranquilli.github.io')return;
    const name=(document.getElementById('user-name-input')?.value||'').trim();
    const email=(document.getElementById('user-email-input')?.value||'').trim().toLowerCase();
    if(!name||!email)return;
    localStorage.setItem('dose_user',JSON.stringify({name,email,role:'user',isAdmin:false,provider:'manual'}));
  },true);
}catch(e){
  console.warn('Russo public guard skipped',e);
}
})();