(function(root){
  'use strict';
  const api=root.DosePranzaSatispayStock;
  if(!api||typeof document==='undefined')return;
  const vendor=location.pathname.includes('pagnottella-gourmet')?'pagnottella':'russo';
  const dashboard=location.pathname.endsWith('/ordini.html');
  const editors={pagnottella:['commerciale@lapagnottellagourmet.it','isidorovagnozzi@gmail.com','isidoro.vagnozzi@gmail.com'],russo:['lorenzo.russo@alimentarirusso','russolorenzo11@gmail.com']};
  let state=api.normalizeStockState(),confirmed=false,unsubscribe,epoch=0,canEdit=false,saveToggle=null,panel=null,busy=false;
  const cacheKey='dose_stock_cache_'+vendor;
  const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  function publish(next,server){
    state=api.normalizeStockState(next);confirmed=server;
    if(server)try{localStorage.setItem(cacheKey,JSON.stringify({day:today(),state}));}catch{}
    root.dispatchEvent(new CustomEvent('dose-stock-change',{detail:{vendor,state,confirmed}}));
    draw();
  }
  function announce(text){
    let region=document.querySelector('[data-stock-notice]');
    if(!region){region=document.createElement('p');region.dataset.stockNotice='';region.className='dose-stock-notice';region.setAttribute('aria-live','polite');region.setAttribute('role','status');(document.querySelector('main')||document.body).prepend(region);}
    region.textContent=text;
  }
  root.DoseStock={announce,get state(){return state;},get confirmed(){return confirmed;},check:item=>confirmed?api.isCatalogItemSoldOut(item,state):{soldOut:false}};
  try{const cached=JSON.parse(localStorage.getItem(cacheKey)||'null');if(cached?.day===today())state=api.normalizeStockState(cached.state);}catch{}
  root.addEventListener('storage',event=>{
    if(event.key!==cacheKey||confirmed)return;
    try{const cached=JSON.parse(event.newValue||'null');if(cached?.day===today())publish(cached.state,false);}catch{}
  });
  const catalog=[];
  let liveCatalog={};
  function status(text){if(panel)panel.querySelector('[data-stock-status]').textContent=text;}
  function draw(){
    if(!panel)return;
    panel.hidden=!canEdit;
    status(confirmed?'Disponibilità sincronizzata con il server.':'Dati non confermati dal server. Modifiche temporaneamente disabilitate.');
    const list=panel.querySelector('[data-stock-items]');list.replaceChildren();
    const names=[...new Set([...catalog,...Object.values(liveCatalog).flat(),...state.soldOutItems])];
    for(const name of names){const button=document.createElement('button');button.type='button';button.textContent=name;const out=state.soldOutItems.some(v=>api.normalize(v)===api.normalize(name));button.setAttribute('aria-pressed',String(out));button.setAttribute('aria-label',(out?'Rendi disponibile ':'Segna esaurito ')+name);button.disabled=!confirmed||busy;button.onclick=()=>toggle('soldOutItems',name,!out);list.append(button);}
    const chips=panel.querySelector('[data-stock-ingredients]');chips.replaceChildren();
    for(const name of state.soldOutIngredients){const button=document.createElement('button');button.type='button';button.textContent=name+' · Ripristina';button.disabled=!confirmed||busy;button.onclick=()=>toggle('soldOutIngredients',name,false);chips.append(button);}
    panel.querySelector('input').disabled=!confirmed||busy;panel.querySelector('[data-stock-add]').disabled=!confirmed||busy;
  }
  async function toggle(field,term,value){
    if(!canEdit||!confirmed||busy||!saveToggle)return;
    term=String(term||'').trim();if(!term||term.length>120){status('Inserisci un nome da 1 a 120 caratteri.');return;}
    busy=true;draw();
    try{await saveToggle(field,term,value);}catch{status('Salvataggio non riuscito. Nessuna disponibilità pubblicata: riprova quando sei online.');}
    finally{busy=false;panel?.querySelectorAll('button,input').forEach(el=>{el.disabled=!confirmed;});}
  }
  async function boot(){
    if(dashboard){
      panel=document.createElement('section');panel.className='dose-stock-panel';panel.hidden=true;
      panel.innerHTML='<h2>Disponibilità Menu / Esauriti (86’d)</h2><p>Premi un piatto per esaurirlo o ripristinarlo. Le modifiche sono condivise con i clienti.</p><p class="dose-stock-status" data-stock-status role="status" aria-live="polite"></p><div class="dose-stock-list" data-stock-items></div><h3>Ingredienti esauriti</h3><form><label>Ingrediente <input maxlength="120" required placeholder="Es. mozzarella"></label><button data-stock-add type="submit">Segna esaurito</button></form><div class="dose-stock-list" data-stock-ingredients></div>';
      document.querySelector('#main-view')?.prepend(panel);
      panel.querySelector('form').onsubmit=event=>{event.preventDefault();const input=panel.querySelector('input');toggle('soldOutIngredients',input.value,true);input.value='';};
      try{const res=await fetch(vendor==='russo'?'../assets/russo-stock-menu.json':'../assets/pagnottella/data/menu.json');if(!res.ok)throw Error();const data=await res.json();catalog.push(...(data.products||[]).map(p=>p.name).filter(Boolean));draw();}catch{status('Catalogo non disponibile. Restano modificabili gli esauriti già registrati.');}
    }
    try{
      if(root.DoseSupplierAccess?.isE2E?.())return;
      const access=root.DoseSupplierAccess||root.supplierAccess;
      if(!access?.ensureFirebase)throw Error('Firebase non disponibile');
      const {app,auth,authSdk}=await access.ensureFirebase();
      const sdk=await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
      // Russo owns Firestore initialization and its long-polling/cache settings.
      let db;
      if(vendor==='russo'&&!dashboard){
        if(!root.DoseRussoStockDatabase)await new Promise((resolve,reject)=>{
          const ready=()=>{clearTimeout(timer);resolve();};
          const timer=setTimeout(()=>{root.removeEventListener('dose-russo-db-ready',ready);reject(Error('Database non pronto'));},15000);
          root.addEventListener('dose-russo-db-ready',ready,{once:true});
        });
        db=root.DoseRussoStockDatabase;
      }else db=sdk.getFirestore(app);
      const ref=sdk.doc(db,'menu_products','dose_stock_'+vendor);
      authSdk.onAuthStateChanged(auth,user=>{
        const current=++epoch;unsubscribe?.();unsubscribe=null;saveToggle=null;canEdit=false;publish(user?state:{},false);
        if(!user||user.isAnonymous)return;
        const email=String(user.email||'').trim().toLowerCase();
        canEdit=user.emailVerified&&(email==='marco.tranquilli@dos.design'||editors[vendor].includes(email));
        saveToggle=async(field,term,value)=>{
          const uid=user.uid;
          await sdk.runTransaction(db,async tx=>{
            if(auth.currentUser?.uid!==uid||epoch!==current)throw Error('Sessione cambiata');
            const snap=await tx.get(ref),next=api.normalizeStockState(snap.data());
            next[field]=next[field].filter(v=>api.normalize(v)!==api.normalize(term));if(value)next[field].push(term);
            tx.set(ref,{supplierId:vendor,soldOutItems:next.soldOutItems,soldOutIngredients:next.soldOutIngredients,updatedAt:sdk.serverTimestamp()},{merge:true});
          });
        };
        unsubscribe=sdk.onSnapshot(ref,{includeMetadataChanges:true},snap=>{if(epoch===current)publish(snap.data(),!snap.metadata.fromCache&&!snap.metadata.hasPendingWrites);},()=>{if(epoch===current){confirmed=false;draw();status('Disponibilità non verificabile: controlla rete e permessi.');}});
        if(dashboard&&canEdit&&vendor==='russo'){
          liveCatalog={};const stops=[unsubscribe];
          for(const collectionName of ['menu_products','custom_creations']){
            stops.push(sdk.onSnapshot(sdk.query(sdk.collection(db,collectionName),sdk.orderBy('name')),snapshot=>{
              if(epoch!==current)return;
              liveCatalog[collectionName]=snapshot.docs.map(doc=>doc.data()).filter(p=>!p.supplierId||p.supplierId===vendor).map(p=>p.name).filter(name=>typeof name==='string'&&name.trim());draw();
            },()=>{if(epoch===current)status('Disponibilità sincronizzata; catalogo aggiuntivo non disponibile.');}));
          }
          unsubscribe=()=>stops.forEach(stop=>stop?.());
        }
      });
    }catch{confirmed=false;draw();status('Disponibilità non verificabile: autenticazione o rete non disponibile.');}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(globalThis);
