(()=>{
const VER='google-final-3';
function txt(sel,v){const el=document.querySelector(sel);if(el)el.textContent=v}
function ux(){
  document.title='DOSepranza | Accesso';
  txt('h1','Accedi al servizio pranzo.');
  txt('.lede','Usa il tuo account Google autorizzato: dopo il login apriremo automaticamente Alimentari Russo.');
  txt('.auth-title','Accesso sicuro');
  txt('.auth-copy','Se il browser blocca la finestra Google, useremo il reindirizzamento automatico.');
  txt('#hub-google-login','Continua con Google');
  txt('#hub-auth-status','Pronto per l accesso.');
  if(!document.getElementById('dose-reset-link')){
    const p=document.createElement('p');
    p.id='dose-reset-link';
    p.className='section-note';
    p.innerHTML='<a href="./reset/?v='+VER+'">Problemi di accesso? Ripristina la sessione</a>';
    document.querySelector('.auth-card')?.after(p);
  }
}
async function clearRuntimeCaches(){
  try{if(navigator.serviceWorker?.getRegistrations){const regs=await navigator.serviceWorker.getRegistrations();await Promise.allSettled(regs.map(r=>r.unregister()));}}catch(e){}
  try{if(window.caches?.keys){const keys=await caches.keys();await Promise.allSettled(keys.map(k=>caches.delete(k)));}}catch(e){}
}
async function warmOne(url){
  try{await fetch(url,{cache:'reload',credentials:'same-origin'});}catch(e){}
  try{await fetch(url+(url.includes('?')?'&':'?')+'v='+VER,{cache:'reload',credentials:'same-origin'});}catch(e){}
}
window.DosePagesCacheWarm={run:async()=>{ux();await clearRuntimeCaches();await Promise.allSettled(['./supplier-access.js','./russo/russo-auth-guard.js','./russo/index.html'].map(warmOne));}};
window.DosePagesCacheWarm.run();
})();