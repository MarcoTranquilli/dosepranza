(()=>{
const p=new URLSearchParams(location.search),pages=location.hostname==='marcotranquilli.github.io',reset=pages&&p.has('swreset'),preview=pages&&p.get('preview')==='admin'&&!reset;
const staff=e=>['marco.tranquilli@dos.design','russolorenzo11@gmail.com','lorenzo.russo@alimentarirusso','beatrice.binini@dos.design','monica.porta@dos.design'].includes(String(e||'').trim().toLowerCase());
const read=()=>{try{return JSON.parse(localStorage.getItem('dose_user')||'null')}catch(e){return null}};
const ok=()=>{const u=read();return !!(u&&u.email&&u.uid&&(String(u.provider||'').toLowerCase()==='google.com'||u.provider==='github-pages-russo-preview'))};
const delDb=n=>new Promise(r=>{try{if(!indexedDB)return r();const q=indexedDB.deleteDatabase(n);q.onsuccess=q.onerror=q.onblocked=()=>r()}catch(e){r()}});
async function clean(){for(const s of [localStorage,sessionStorage]){if(!s)continue;for(const k of Object.keys(s))if(k.startsWith('dose_')||k.includes('firebase'))s.removeItem(k)}await Promise.allSettled([delDb('firebaseLocalStorageDb'),delDb('firebase-heartbeat-database'),caches?.keys?.().then(a=>Promise.all(a.map(k=>caches.delete(k)))).catch(()=>{}),navigator.serviceWorker?.getRegistrations?.().then(a=>Promise.all(a.map(r=>r.unregister()))).catch(()=>{})])}
if(reset){clean().finally(()=>location.replace('../login-google-final.html?next=russo&v=pages-auth-fix-1'));return}
if(preview)localStorage.setItem('dose_user',JSON.stringify({uid:'russo-review-preview',name:'Anteprima interna',email:'review.russo@dosepranza.local',role:'review',isAdmin:true,provider:'github-pages-russo-preview'}));
const cached=read();if(pages&&staff(cached&&cached.email)&&!ok()){localStorage.removeItem('dose_user');localStorage.removeItem('menu_admin_open');location.replace('../login-google-final.html?next=russo&v=pages-auth-fix-1');return}
async function verify(){const access=window.DoseSupplierAccess;if(!access||access.isFilePreview?.()||access.isE2E?.()||ok())return;try{const s=await access.resolveSession?.();if(s||ok())return}catch(e){}location.replace('../login-google-final.html?next=russo&v=pages-auth-fix-1')}
verify();
})();