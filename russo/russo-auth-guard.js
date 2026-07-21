(()=>{
try{
 const p=new URLSearchParams(location.search);
 const reset=location.hostname==='marcotranquilli.github.io'&&p.has('swreset');
 const delDb=n=>new Promise(r=>{try{if(!indexedDB)return r();const q=indexedDB.deleteDatabase(n);q.onsuccess=q.onerror=q.onblocked=()=>r()}catch(e){r()}});
 async function clean(){
  try{localStorage.removeItem('dose_user');localStorage.removeItem('menu_admin_open')}catch(e){}
  try{sessionStorage.clear()}catch(e){}
  await Promise.allSettled([
   delDb('firebaseLocalStorageDb'),
   delDb('firebase-heartbeat-database'),
   caches?.keys?.().then(a=>Promise.all(a