(()=>{
const VER='google-final-3';
async function clearRuntimeCaches(){
  try{if(navigator.serviceWorker?.getRegistrations){const regs=await navigator.serviceWorker.getRegistrations();await Promise.allSettled(regs.map(r=>r.unregister()));}}catch(e){}
  try{if(window.caches?.keys){const keys=await caches.keys();await Promise.allSettled(keys.map(k=>caches.delete(k)));}}catch(e){}
}
async function warm(url){try{await fetch(url+(url.includes('?')?'&':'?')+'v='+VER,{cache:'reload',credentials:'same-origin'});}catch(e){}}
window.DosePagesCacheWarm={run:async()=>{await clearRuntimeCaches();await Promise.allSettled([warm('./supplier-access.js'),warm('./russo/russo-auth-guard.js'),warm('./russo/index.html')]);}};
window.DosePagesCacheWarm.run();
})();
