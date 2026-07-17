(()=>{
const p=new URLSearchParams(location.search),pages=location.hostname==='marcotranquilli.github.io',reset=pages&&p.has('swreset'),preview=pages&&p.get('preview')==='admin'&&!reset;
const ok=()=>{try{const u=JSON.parse(localStorage.getItem('dose_user')||'null');return !!(u&&u.email&&u.uid&&(String(u.provider||'').toLowerCase()==='google.com'||u.provider==='github-pages-russo-preview'))}catch(e){return false}};
const delDb=n=>new Promise(r=>{try{if(!indexedDB)return r();const q=indexedDB.deleteDatabase(n);q.onsuccess=q.onerror=q.onblocked=()=>r()}catch(e){r()}});
async function clean(){for(const s of [localStorage,sessionStorage]){if(!s)continue;for(const k of Object.keys(s))if(k.startsWith('dose_')||k.includes('firebase'))s.removeItem(k)}await Promise.allSettled([delDb('firebaseLocalStorageDb'),delDb('firebase-heartbeat-database'),caches?.keys?.().then(a=>Promise.all(a.map(k=>caches.delete(k)))).catch(()=>{}),navigator.serviceWorker?.getRegistrations?.().then(a=>Promise.all(a.map(r=>r.unregister()))).catch(()=>{})])}
if(reset){clean().finally(()=>location.replace('../?session=clean&v=google-final-3'));return}
if(preview)localStorage.setItem('dose_user',JSON.stringify({uid:'russo-review-preview',name:'Anteprima interna',email:'review.russo@dosepranza.local',role:'review',isAdmin:true,provider:'github-pages-russo-preview'}));
async function verify(){const access=window.DoseSupplierAccess;if(!access||access.isFilePreview?.()||access.isE2E?.()||ok())return;try{const s=await access.resolveSession?.();if(s||ok())return}catch(e){}location.replace('../?next=russo&v=google-final-3')}
verify();
})();
