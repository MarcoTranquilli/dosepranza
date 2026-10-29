(async()=>{
 const C=window.DoseCustomerCore;
 const host=document.createElement('section');host.className='dose-personal';host.hidden=true;
 (document.getElementById('personal-lunch-card-container') || document.body).prepend(host);
 const [{getApps},{getAuth,onAuthStateChanged},sdk]=await Promise.all([
 import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js')]);
 let epoch=0;
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const button=(text,action)=>{const b=node('button',text);b.type='button';b.addEventListener('click',()=>Promise.resolve().then(action).catch(()=>{status.textContent='Operazione non disponibile. Riprova dopo aver verificato accesso e permessi.';}));return b;};
 const status=node('p');status.setAttribute('role','status');
 function attach(app){const auth=getAuth(app),db=sdk.getFirestore(app);
 onAuthStateChanged(auth,async user=>{
 const generation=++epoch;host.replaceChildren();host.hidden=true;
 if(!user||user.isAnonymous||!user.emailVerified||!user.providerData.some(p=>p.providerId==='google.com')||!user.email?.toLowerCase().endsWith('@dos.design'))return;
 const valid=()=>epoch===generation&&auth.currentUser?.uid===user.uid;
 host.hidden=false;const header=node('header');header.className='dose-personal-header';const refresh=button('Aggiorna catalogo',showFavorites);refresh.className='dose-personal-refresh';header.append(node('h2','Il tuo pranzo'),refresh);host.append(header,status);status.textContent='';
 const supplier=location.pathname.includes('/russo/')?'russo':'pagnottella';
 const catalog=()=>window.DoseCustomerCatalog?.list()||[];
 const favoriteBox=node('div');favoriteBox.className='dose-favorites';host.append(favoriteBox);
 const favorites=new Set();
 async function showFavorites(){favoriteBox.replaceChildren();
 const select=node('select');select.setAttribute('aria-label','Prodotto da salvare tra i preferiti');
 const placeholder=node('option','Seleziona dal catalogo...');placeholder.value='';select.append(placeholder);
 for(const p of catalog()){const o=node('option',p.name);o.value=String(p.id);select.append(o);}
 const selector=node('div');selector.className='dose-personal-selector';const saveButton=button('Salva come preferito',()=>save(select.value,true));saveButton.className='dose-favorite-save';saveButton.disabled=true;select.addEventListener('change',()=>{saveButton.disabled=!select.value;});selector.append(select,saveButton);favoriteBox.append(selector,node('h3','I tuoi preferiti'));
 const row=node('div');row.className='dose-favorite-row';favoriteBox.append(row);
 for(const id of favorites){const p=catalog().find(p=>String(p.id)===id);if(!p)continue;
 const card=node('div');card.className='dose-favorite-chip';const choose=button('Scegli',()=>window.DoseCustomerCatalog.choose(id));choose.setAttribute('aria-label','Scegli '+p.name);const remove=button('×',()=>save(id,false));remove.className='dose-favorite-remove';remove.setAttribute('aria-label','Rimuovi '+p.name+' dai preferiti');card.append(node('strong',p.name),choose,remove);row.append(card);}
 if(!row.childElementCount){const empty=node('p','Salva i tuoi piatti preferiti per ritrovarli qui.');empty.className='dose-favorites-empty';row.append(empty);}
 }
 async function save(id,add){if(!valid()||!id)return;const ref=sdk.doc(db,'users',user.uid);
 await sdk.runTransaction(db,async tx=>{const snap=await tx.get(ref);if(!valid())throw Error('Account cambiato');const map=snap.data()?.favorites||{};const list=new Set((map[supplier]||[]).filter(x=>typeof x==='string'));add?list.add(id):list.delete(id);if(list.size>100)throw Error('Limite preferiti');tx.set(ref,{favorites:{...map,[supplier]:[...list]}},{merge:true});});
 if(!valid())return;add?favorites.add(id):favorites.delete(id);await showFavorites();}
 try{const snap=await sdk.getDoc(sdk.doc(db,'users',user.uid));if(!valid())return;for(const id of snap.data()?.favorites?.[supplier]||[])if(typeof id==='string')favorites.add(id);await showFavorites();}catch{if(valid())status.textContent='Preferiti non disponibili: verificare le regole del profilo.';}
 if(!valid())return;
 const shortcuts=node('nav');shortcuts.className='dose-personal-shortcuts';shortcuts.setAttribute('aria-label','Scorciatoie personali');const history=node('div');host.append(shortcuts,history);shortcuts.append(button('Ultimo ordine',async()=>{
 history.replaceChildren();
 // Owner filter is enforced server-side. No reading of colleagues for personalization.
 const q=sdk.query(sdk.collection(db,'orders'),sdk.where('uid','==',user.uid),sdk.where('supplierId','==',supplier),sdk.where('confirmationStatus','==','CONFIRMED'),sdk.orderBy('createdAt','desc'),sdk.limit(1));
 const snapshot=await sdk.getDocs(q);if(!valid())return;
 if(snapshot.empty){history.append(node('p','Nessun ordine con conferma esplicita disponibile.'));return;}
 const order=snapshot.docs[0].data();history.append(node('p',(order.items||[]).map(i=>`${i.quantity??i.qty??1} × ${i.name}`).join(' · ')));
 const repeat=button('Ordina di nuovo',()=>{if(!valid())return;if(!C.open(supplier)){status.textContent='Ordini chiusi. Riprova nella prossima giornata di servizio; verifica le chiusure del fornitore.';return;}
 const plan=C.reconcile(order.items,catalog());window.DoseCustomerCatalog.reorder(plan);status.textContent='Prodotti aggiunti al carrello ai prezzi attuali. Controlla prima di confermare.';});
 repeat.disabled=!C.open(supplier);history.append(repeat,node('p','Prezzi e disponibilità vengono verificati al click. Nessun invio o pagamento automatico.'));
 }));
 if(!C.manager(user.email))return;
 const panel=node('div'),date=node('input');date.type='date';date.value=C.day();date.setAttribute('aria-label','Data degli ordini ufficio');
 const result=node('div');let request=0;
 async function load(){const ticket=++request;result.replaceChildren(node('p','Caricamento...'));const {start,end}=C.range(date.value);let cursor;const rows=[];
 for(;;){let q=sdk.query(sdk.collection(db,'orders'),sdk.where('createdAt','>=',start),sdk.where('createdAt','<',end),sdk.orderBy('createdAt'),sdk.limit(250));if(cursor)q=sdk.query(q,sdk.startAfter(cursor));const snap=await sdk.getDocs(q);if(!valid()||ticket!==request)return;rows.push(...snap.docs.map(d=>d.data()));if(rows.length>5000)throw Error('Troppi ordini');if(snap.size<250)break;cursor=snap.docs.at(-1);}
 result.replaceChildren();for(const id of ['russo','pagnottella']){result.append(node('h3',id==='russo'?'Alimentari Russo':'Pagnottella Gourmet'));const table=node('table'),head=node('tr');for(const h of ['Cliente','Prodotti','Note','Stato'])head.append(node('th',h));table.append(head);
 for(const o of rows.filter(o=>o.supplierId===id)){const tr=node('tr');for(const value of [o.user||o.userName||o.email||'Nominativo non disponibile',(o.items||[]).map(i=>`${i.quantity??i.qty??1} × ${i.name}`).join(' · '),o.allergies||o.notes||'',o.confirmationStatus||o.orderStatus||'Non verificato'])tr.append(node('td',String(value)));table.append(tr);}result.append(table);}
 }
 const toggle=button('Riepilogo Ordini Ufficio',async()=>{panel.hidden=!panel.hidden;if(!panel.hidden)await load();});shortcuts.append(toggle);host.append(panel);panel.hidden=true;panel.append(node('h3','Ordini ufficio · sola lettura'),date,button('Mostra data',load),result);
 });}
 const timer=setInterval(()=>{const app=getApps().find(a=>a.name==='[DEFAULT]');if(app){clearInterval(timer);attach(app);}},500);
 setTimeout(()=>clearInterval(timer),30000);
})().catch(()=>{const message=document.createElement('p');message.textContent='Area personale non disponibile. Ricarica la pagina per riprovare.';document.body.prepend(message);});
