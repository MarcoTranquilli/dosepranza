import {getApps} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import {getFirestore,collection,query,where,orderBy,limit,onSnapshot} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
const A=window.DoseOrderAnalytics,C=window.DoseCustomerCore,S=window.DoseSupplierAccess;
const el=id=>document.getElementById(id), money=c=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(c/100);
let db,auth,stop,epoch=0,rows=[],supplier='all',ready=false,isFromCache=true,authObserver=null,bootPromise=null;
const allowed=u=>u&&!u.isAnonymous&&u.emailVerified&&u.providerData.some(p=>p.providerId==='google.com')&&C.manager(u.email);
const text=(id,value)=>{el(id).textContent=value;};
function clear(){isFromCache=true;el('admin-cache-status').hidden=true;for(const id of ['kpi-revenue','kpi-revenue-sub','kpi-orders-count','kpi-users-count','kpi-avg-ticket','orders-found-count','russo-tot','russo-count','russo-items','pagnottella-tot','pagnottella-count','pagnottella-items'])text(id,'—');rows=[];ready=false;el('orders-tbody').replaceChildren();el('packing-list').replaceChildren();for(const id of ['btn-export-csv','btn-copy-summary'])el(id).disabled=true;}
function selected(){return A.select(rows,{supplier,range:A.rangeFor('custom',new Date(),el('date-select').value,el('date-select').value)});}
function render(){
 if(!allowed(auth.currentUser)||!ready)return;
 const result=selected(),data=result.rows,k=A.aggregate(data);
 text('kpi-revenue',money(k.cents));text('kpi-revenue-sub',`${k.count} ordini validi`);text('kpi-orders-count',k.count);text('kpi-users-count',`${k.uniqueUsers} colleghi`);text('kpi-avg-ticket',k.averageCents==null?'—':money(k.averageCents));text('orders-found-count',`${k.count} ordini`);
 for(const id of ['russo','pagnottella']){const g=A.aggregate(data.filter(o=>o.supplierId===id));text(id+'-tot',money(g.cents));text(id+'-count',g.count);text(id+'-items',g.units);}
 text('data-status',`${result.excluded} record esclusi dai calcoli. Valore ordinato, non incasso verificato. ${isFromCache ? 'Dati da cache locale, non verificati dal server.' : 'Dati sincronizzati dal server.'} Orario di riferimento Pagnottella: 11:00, non blocca gli ordini.`);
 const body=el('orders-tbody');body.replaceChildren();
 for(const o of data){const tr=document.createElement('tr');for(const value of [new Intl.DateTimeFormat('it-IT',{timeZone:A.ZONE,hour:'2-digit',minute:'2-digit'}).format(A.toDate(o.createdAt)),o.user||o.email||'Non disponibile',A.SUPPLIERS[A.supplier(o)],o.items.map(i=>`${A.quantity(i)} × ${i.name}${i.details?' · '+i.details:''}`).join('; ')+(o.notes||o.allergies?' — '+(o.notes||o.allergies):''),money(Math.round(o.total*100)),o.confirmationStatus||o.orderStatus||o.status||'Non verificato']){const td=document.createElement('td');td.textContent=value;tr.append(td);}body.append(tr);}
 if(!data.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=6;td.textContent='Nessun ordine valido per la selezione.';tr.append(td);body.append(tr);}
 const packing=new Map();for(const o of data)for(const i of o.items){const label=`${A.SUPPLIERS[A.supplier(o)]} · ${i.name}${i.details?' · '+i.details:''}`;packing.set(label,(packing.get(label)||0)+A.quantity(i));}
 el('packing-list').replaceChildren();for(const [label,n] of packing){const li=document.createElement('li');li.textContent=`${n} × ${label}`;el('packing-list').append(li);}
 for(const id of ['btn-export-csv','btn-copy-summary'])el(id).disabled=!data.length;
}
function load(){
 stop?.();stop=null;const ticket=++epoch;clear();if(!db||!allowed(auth.currentUser))return;
 try{const range=A.rangeFor('custom',new Date(),el('date-select').value,el('date-select').value);text('data-status','Caricamento...');stop=onSnapshot(query(collection(db,'orders'),where('createdAt','>=',range.startDate),where('createdAt','<',range.endDate),orderBy('createdAt'),limit(5001)),{includeMetadataChanges:true},snap=>{
 if(ticket!==epoch||!allowed(auth.currentUser))return;
 if(snap.size>5000){clear();text('data-status','Limite di 5000 ordini superato: riepilogo ed export disabilitati.');return;}
 isFromCache=snap.metadata.fromCache;el('admin-cache-status').hidden=!isFromCache;
 rows=snap.docs.map(d=>{const o=d.data();return {...o,id:d.id,uid:o.uid??o.userId,email:o.email??o.userEmail,user:o.user??o.userName,total:o.total??o.totalAmount??(Number.isSafeInteger(o.totalCents)?o.totalCents/100:undefined)};});ready=true;render();
 },error=>{if(ticket!==epoch)return;clear();text('data-status',`Lettura non disponibile (${error.code||'errore'}). Verificare permessi e indici.`);});}catch{clear();text('data-status','Seleziona una data valida non futura.');}
}
el('date-select').value=C.day();el('date-select').max=C.day();
el('date-select').addEventListener('change',load);el('btn-refresh').onclick=load;
el('btn-date-today').onclick=()=>{el('date-select').value=C.day();load();};
el('btn-date-yesterday').onclick=()=>{const d=new Date(C.day()+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-1);el('date-select').value=d.toISOString().slice(0,10);load();};
el('supplier-tabs').onclick=e=>{const b=e.target.closest('[data-supplier]');if(!b)return;supplier=b.dataset.supplier;for(const t of el('supplier-tabs').children){t.classList.toggle('active',t===b);t.setAttribute('aria-pressed',String(t===b));}if(ready)render();};
el('btn-admin-login').onclick=async()=>{try{await S.signInWithGoogle();await bootstrapAuth();}catch{text('auth-guard-status','Accesso Google non completato. Riprova in una scheda del browser.');}};
el('btn-admin-logout').onclick=async()=>{stop?.();++epoch;clear();el('admin-app').hidden=true;el('auth-guard').hidden=false;try{await S.signOut();}catch{text('auth-guard-status','Uscita non completata. Riprova.');}};
el('btn-export-csv').onclick=()=>{if(!ready||!allowed(auth.currentUser))return;const url=URL.createObjectURL(new Blob([A.csv(selected().rows,{includeSource:true,fromCache:isFromCache})],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`ordini-${el('date-select').value}-${supplier}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
el('btn-copy-summary').onclick=async()=>{if(!ready||!allowed(auth.currentUser))return;try{await navigator.clipboard.writeText(`DOSepranza · ${el('date-select').value}\n${isFromCache ? 'DATI DA CACHE LOCALE - NON VERIFICATI' : 'Dati sincronizzati dal server'}\n${el('packing-list').innerText}`);text('data-status','Lista di ritiro copiata.');}catch{text('data-status','Copia non disponibile nel browser.');}};
clear();
async function bootstrapAuth(){
 if(authObserver)return;
 if(bootPromise)return bootPromise;
 bootPromise=(async()=>{
  const existing=getApps().find(a=>a.name==='[DEFAULT]');
  const app=existing||(await S.ensureFirebase()).app;
  auth=getAuth(app);db=getFirestore(app);
 authObserver=onAuthStateChanged(auth,user=>{stop?.();++epoch;clear();const ok=allowed(user);el('admin-app').hidden=!ok;el('auth-guard').hidden=!!ok;if(!ok){text('auth-guard-status','Accedi con un account Google verificato e autorizzato.');return;}text('current-admin-email',`${user.email} · ${S.roleLabel(S.roleForEmail(user.email))}`);load();});
  Promise.resolve().then(()=>S.resolveSession()).catch(()=>{
   if(!allowed(auth.currentUser))text('auth-guard-status','Sessione automatica non disponibile. Accedi con Google.');
  });
 })();
 try{await bootPromise;}finally{bootPromise=null;}
}
clear();
try{await bootstrapAuth();}catch{text('auth-guard-status','Autenticazione non disponibile. Riprova con il pulsante Google.');}
