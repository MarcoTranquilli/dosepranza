(()=>{
const $=id=>document.getElementById(id),ADMIN='marco.tranquilli@dos.design';
const st=$('hub-auth-status'),btn=$('hub-google-login'),adm=$('admin-actions');
const set=m=>{if(st)st.textContent=m},norm=v=>String(v||'').trim().toLowerCase(),first=(...v)=>v.find(x=>String(x||'').trim()),sleep=ms=>new Promise(r=>setTimeout(r,ms));
function makeSession(user,result){const t=result?._tokenResponse||{},p=(user?.providerData||[])[0]||{},email=norm