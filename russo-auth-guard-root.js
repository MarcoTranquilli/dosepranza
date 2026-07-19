(()=>{
const p=new URLSearchParams(location.search),reset=p.has('swreset'),preview=p.get('preview')==='admin'&&!reset;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const delDb=n=>new Promise(r=>{try{const q=indexedDB.deleteDatabase(n);q.onsuccess=q.onerror=q.onblocked=()=>r()}catch(e){r()}});
async function clean(){for(const s of [localStorage,sessionStorage]){if(!s)continue;for(const k of Object.keys(s))if(k.startsWith('dose_')||k.includes('firebase'))s.removeItem(k)}await Promise.allSettled([delDb('firebaseLocalStorageDb'),delDb('firebase-heartbeat-database'),caches?.keys?.().then(a=>Promise.all(a.map(k=>caches.delete(k)))).catch(()=>{}),navigator.serviceWorker?.getRegistrations?.().then(a=>Promise.all(a.map(r=>r.unregister()))).catch(()=>{})])}
if(reset){clean().finally(()=>location.replace('./?session=clean&v=auth-guard-2'));return}
if(preview){localStorage.setItem('dose_user',JSON.stringify({uid:'russo-review-preview',name:'Anteprima interna',email:'review.russo@dosepranza.local',role:'review',isAdmin:true,provider:'github-pages-russo-preview'}));return}
async function waitAuth(){for(let i=0;i<40;i++){const u=window.auth_fb?.currentUser;if(u&&!u.isAnonymous&&u.email)return u;await sleep(125)}return null}
async function verify(){const access=window.DoseSupplierAccess;if(access?.isFilePreview?.()||access?.isE2E?.())return;try{await access?.resolveSession?.()}catch(e){}const u=await waitAuth();if(u){localStorage.setItem('dose_user',JSON.stringify({uid:u.uid,email:u.email,name:u.displayName||u.email.split('@')[0],provider:'google.com'}));return}localStorage.removeItem('dose_user');location.replace('./login-google-final.html?v=auth-guard-2&next=russo&reason=firebase-auth-required')}
verify();
})();