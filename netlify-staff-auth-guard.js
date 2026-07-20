(()=>{
const S=new Set(['marco.tranquilli@dos.design','lorenzo.russo@alimentarirusso','russolorenzo11@gmail.com','beatrice.binini@dos.design','monica.porta@dos.design']);
const norm=v=>String(v||'').trim().toLowerCase();
const cached=()=>{try{return JSON.parse(localStorage.getItem('dose_user')||'null')}catch(e){return null}};
function stale(){
 const email=norm(cached()?.email);
 if(!S.has(email))return false;
 const u=window.auth_fb?.currentUser;
 const providers=(u?.providerData||[]).map(p=>p?.providerId).filter(Boolean);
 return !u||u.isAnonymous||!providers.includes('google.com');
}
function fix(){
 if(!stale())return;
 localStorage.removeItem('dose_user');
 localStorage.removeItem('menu_admin_open');
 const url=new URL(location.href);
 if(url.searchParams.get('authreset')==='1')return;
 url.searchParams.set('authreset','1');
 url.searchParams.set('swreset','1');
 location.replace(url.toString());
}
let tries=0;
const timer=setInterval(()=>{
 tries+=1;
 if(window.auth_fb||tries>40){clearInterval(timer);fix();}
},100);
setTimeout(fix,2000);
})();
