import {signInWithPopup,GoogleAuthProvider,onAuthStateChanged,signOut,getRedirectResult,signInWithRedirect} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import {getFirestore,collection,query,where,onSnapshot} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
const C=window.DosePagnottellaOrders,A=window.DoseOrderAnalytics,el=id=>document.getElementById(id);
const audio=window.DoseSupplierAudio?.mount('pagnottella');
let auth,db,stop,flow,epoch=0,orders=[],report='';
const money=n=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(n);
const status=message=>{el('access-status').textContent=message;};
function clear(){orders=[];report='';for(const id of ['packing-tbody','orders-tbody'])el(id).replaceChildren();for(const id of ['kpi-orders','kpi-items','kpi-total'])el(id).textContent='—';el('btn-copy-wa').disabled=true;el('btn-print').disabled=true;}
function cell(tr,text){const td=document.createElement('td');td.textContent=text;tr.append(td);return td;}
function render(){
  const range=A.rangeFor('custom',new Date(),el('order-date').value,el('order-date').value);
  const selected=A.select(orders,{supplier:'pagnottella',range}).rows;
  const groups=C.packing(selected);const total=selected.reduce((s,o)=>s+Math.round(o.total*100),0)/100;
  el('kpi-orders').textContent=selected.length;el('kpi-items').textContent=selected.reduce((s,o)=>s+o.items.reduce((n,i)=>n+C.quantity(i),0),0);el('kpi-total').textContent=money(total);
  report=`PAGNOTTELLA GOURMET · ${el('order-date').value}\n${el('sync-status').textContent}\n`;
  const packing=el('packing-tbody');packing.replaceChildren();
  for(const [key,label] of [['bread','Pane / base'],['recipes','Ricette'],['extras','Extra']]){report+=`\n${label}\n`;for(const [name,n] of groups[key]){const tr=document.createElement('tr');cell(tr,`${n} ×`);cell(tr,`${label}: ${name}`);packing.append(tr);report+=`${n} × ${name}\n`;}}
  const body=el('orders-tbody');body.replaceChildren();
  for(const o of selected){const tr=document.createElement('tr');const time=new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit'}).format(A.toDate(o.createdAt));const name=o.user||o.userName||o.email||'Collega';const description=o.items.map(i=>`${C.quantity(i)} × ${C.composition(i)}`).join('; ');cell(tr,time);cell(tr,name);const detail=cell(tr,description);const notes=[o.notes,o.allergies].filter(Boolean).join(' · ');if(notes){const note=document.createElement('span');note.className='order-note';note.textContent=notes;detail.append(note);}cell(tr,money(o.total));body.append(tr);report+=`\n${time} ${name}: ${description}${notes?' — '+notes:''} · ${money(o.total)}\n`;}
  if(!selected.length){for(const target of [packing,body]){const tr=document.createElement('tr');const td=cell(tr,'Nessun ordine valido per questa data.');td.colSpan=target===body?4:2;target.append(tr);}}
  el('btn-copy-wa').disabled=!selected.length;el('btn-print').disabled=!selected.length;
}
el('order-date').value=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());el('order-date').max=el('order-date').value;
el('order-date').onchange=()=>{try{render();}catch{clear();status('Data non valida.');}};
el('btn-login').onclick=async()=>{
 if(!flow || el('btn-login').disabled)return;
 el('btn-login').disabled=true;
 try{await flow.login();}finally{el('btn-login').disabled=window.DoseSupplierLogin.embedded(navigator.userAgent);}
};
async function logout(){
 stop?.();stop=null;++epoch;clear();el('main-view').style.display='none';el('login-view').style.display='block';
 el('btn-blocked-logout').disabled=true;el('btn-login').disabled=true;
 try{await signOut(auth);flow?.reset();status('Sessione rimossa. Premi Accedi con Google e scegli l’account concordato.');el('btn-blocked-logout').hidden=true;}
 catch{status('Disconnessione non riuscita. Riprova oppure apri il link nel browser di sistema.');}
 finally{el('btn-blocked-logout').disabled=false;el('btn-login').disabled=false;}
}
el('btn-logout').onclick=logout;el('btn-blocked-logout').onclick=logout;
el('btn-print').onclick=()=>{if(C.allowed(auth?.currentUser)&&report)window.print();};
el('btn-copy-wa').onclick=async()=>{if(!C.allowed(auth?.currentUser)||!report)return;try{await navigator.clipboard.writeText(report);status('Distinta copiata.');}catch{status('Copia non disponibile. Usa la stampa.');}};
clear();el('login-view').style.display='block';
try{
 const core=await window.DoseSupplierAccess.ensureFirebase();auth=core.auth;db=getFirestore(core.app);
 flow=window.DoseSupplierLogin.createFlow({auth,sdk:{GoogleAuthProvider,signInWithPopup,signInWithRedirect,getRedirectResult},status,onIssue:()=>{el('btn-blocked-logout').hidden=false;}});
 const adoptUser=user=>{
  stop?.();stop=null;const ticket=++epoch;clear();const ok=C.allowed(user);
  el('login-view').style.display=ok?'none':'block';el('main-view').style.display=ok?'block':'none';el('btn-blocked-logout').hidden=!user||ok;
  if(!ok){status(user?`Accesso negato (account non autorizzato) per ${String(user.email || '(email non disponibile)').trim().toLowerCase()}. Questo account Google non è abilitato per Pagnottella Gourmet. Accedi con isidorovagnozzi@gmail.com o con l’account Google concordato e verificato.`:'Accedi con Google per consultare gli ordini.');return;}
  status('');el('user-email-display').textContent=user.email;
  audio?.reset();
  stop=onSnapshot(query(collection(db,'orders'),where('supplierId','==','pagnottella')),{includeMetadataChanges:true},snap=>{
   if(ticket!==epoch||!C.allowed(auth.currentUser))return;
   orders=snap.docs.map(d=>({...d.data(),id:d.id}));el('sync-status').textContent=snap.metadata.fromCache?'Cache locale: dati non verificati':'Sincronizzato dal server';
   audio?.observe(orders.map(o=>({id:o.id,day:A.toDate(o.createdAt)?window.DoseSupplierAudio.day(A.toDate(o.createdAt)):''})),el('order-date').value,snap.metadata.fromCache,snap.metadata.hasPendingWrites);
   try{render();}catch{clear();status('Impossibile elaborare i dati. Verifica la data.');}
  },()=>{if(ticket!==epoch)return;clear();status('Lettura non disponibile. Verifica permessi e connessione.');});
 };
 onAuthStateChanged(auth,adoptUser);
 const recovered=await flow.recover();
 if(recovered.user&&!stop)adoptUser(recovered.user);
 el('btn-login').disabled=window.DoseSupplierLogin.embedded(navigator.userAgent);
}catch{status('Autenticazione non disponibile. Ricarica la pagina per riprovare.');el('btn-login').disabled=true;}
