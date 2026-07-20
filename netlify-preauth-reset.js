(()=>{
try{
 if(!location.hostname.includes('netlify.app'))return;
 const key='dose_staff_cache_preauth_reset_v2';
 if(sessionStorage.getItem(key)==='1')return;
 const staff=['marco.tranquilli@dos.design','lorenzo.russo@alimentarirusso','russolorenzo11@gmail.com','beatrice.binini@dos.design','monica.porta@dos.design'];
 const raw=JSON.parse(localStorage.getItem('dose_user')||'null');
 const email=String(raw?.email||'').trim().toLowerCase();
 if(!staff.includes(email))return;
 localStorage.removeItem('dose_user');
 localStorage.removeItem('menu_admin_open');
 sessionStorage.setItem(key,'1');
}catch(e){}
})();
