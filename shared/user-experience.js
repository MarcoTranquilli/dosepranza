(async function() {
  'use strict';
  const P=window.DosePreferences;
  if(!P) return;
  const supplier=location.pathname.includes('/russo/')?'russo':location.pathname.includes('pagnottella')?'pagnottella':null;
  if(!supplier) {
    const badges = ['russo','pagnottella'].map(vendor => {
      const card = document.getElementById(`card-${vendor}`);
      if(!card)return null;
      const badge = document.createElement('p');
      badge.className='supplier-badge';badge.setAttribute('aria-live','polite');badge.setAttribute('aria-atomic','true');
      badge.style.fontVariantNumeric='tabular-nums';card.querySelector('h3')?.after(badge);
      return {vendor,badge};
    }).filter(Boolean);
    const tick = () => {
      if(!window.DosePranzaCutoff)return;
      for(const {vendor,badge} of badges){
        const state=window.DosePranzaCutoff.evaluateCutoff(vendor,{nowMs:window.DoseClock?.now() ?? Date.now()});
        const text=vendor==='russo'
          ? state.isPassed?'Ordini chiusi alle 10:30':state.isCountdownActive?`Chiude tra ${state.formattedRemaining}`:'Aperto fino alle 10:30'
          : state.isPassed?'Oltre le 11:00 (su disponibilità)':state.isCountdownActive?`Riferimento tra ${state.formattedRemaining}`:'Consigliato entro le 11:00';
        if(badge.textContent!==text)badge.textContent=text;
      }
    };
    let timer;
    const start=()=>{clearInterval(timer);tick();timer=setInterval(tick,1000);};
    window.addEventListener('pageshow',start);
    window.addEventListener('pagehide',()=>clearInterval(timer));
    start();
  }
  let uid=null, signature='', activeFilter='all';
  const node=(tag,text)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;return element;};
  const button=(text,action)=>{const element=node('button',text);element.type='button';element.addEventListener('click',()=>{try{action();}catch(error){status.textContent=error.message;}});return element;};
  const host=node('section');host.className='dose-ux';host.hidden=true;
  const status=node('p');status.className='dose-ux-status';status.setAttribute('role','status');
  const receipts=node('section');receipts.className='dose-ux';receipts.hidden=true;
  const dialog=node('dialog');dialog.className='dose-receipt-dialog';dialog.setAttribute('aria-label','Dettagli ricevuta locale');document.body.append(dialog);
  const names={russo:'Alimentari Russo',pagnottella:'Pagnottella Gourmet'};
  const euros=value=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(value);
  let noteInput, noteChip, filters, noteOwner, noteAutofill;
  function adapter(){return window.DosePreferenceCart;}
  function mount() {
    const main=document.querySelector('main');
    if(main&&!receipts.parentNode)main.prepend(receipts);
    if(!supplier)return;
    const anchor=document.getElementById(supplier==='russo'?'russo-usual':'usual-order');
    if(anchor&&!host.parentNode)anchor.before(host);
    const grid=document.getElementById(supplier==='russo'?'menu-container':'grid');
    if(grid&&!filters){
      filters=node('div');filters.className='dose-food-filters';filters.setAttribute('aria-label','Filtri alimentari');
      for(const [tag,label] of [['all','Tutti'],...Object.entries(P.labels)]) {
        const pill=button(label,()=>{activeFilter=activeFilter===tag?'all':tag;for(const item of filters.children)item.setAttribute('aria-pressed',String(item.dataset.tag===activeFilter));window.dispatchEvent(new CustomEvent('dose:food-filter',{detail:{supplier,tag:activeFilter}}));});
        pill.dataset.tag=tag;pill.setAttribute('aria-pressed',String(tag==='all'));filters.append(pill);
      }
      grid.before(filters);
      const help=node('p','Tag riferiti alla ricetta base, non alle aggiunte. Nessuna garanzia sulle contaminazioni: verifica le esigenze alimentari con il fornitore.');help.className='dose-food-help';grid.before(help);
    }
    const input=document.getElementById(supplier==='russo'?'allergies-input':'notes');
    if(input&&input!==noteInput){
      noteInput=input;noteChip=button('',()=>{if(!uid||noteInput.value.trim())return;const saved=P.profile(uid,supplier);noteInput.value=saved.allergies||saved.notes;noteInput.dispatchEvent(new Event('input',{bubbles:true}));});noteChip.className='dose-note-chip';input.after(noteChip);
      input.addEventListener('input',refreshNote);
      const saveBox=node('div');saveBox.className='dose-ux';const label=node('input');label.placeholder='Nome della combinazione';label.maxLength=60;label.setAttribute('aria-label','Nome del nuovo preferito');
      saveBox.append(label,button('Salva combinazione nei preferiti',()=>{if(!uid)throw Error('Accedi per salvare i preferiti.');const cart=adapter()?.snapshot();P.saveFavorite(uid,supplier,cart,label.value);label.value='';signature='';refresh();status.textContent='Preferito salvato su questo browser.';}));noteChip.after(saveBox);
    }
  }
  function refreshNote(){if(!noteInput)return;
    const owner=uid||'guest';if(noteOwner!==owner){if(noteOwner!==undefined&&(noteOwner!=='guest'||noteInput.value===noteAutofill))noteInput.value='';noteOwner=owner;const saved=P.profile(uid,supplier);if(!noteInput.value.trim()){noteInput.value=saved.allergies||saved.notes;noteAutofill=noteInput.value;}}
    const saved=P.profile(uid,supplier),last=saved.allergies||saved.notes;noteChip.hidden=!uid||!!noteInput.value.trim()||!last;noteChip.textContent=`Usa nota precedente: "${last}"`;}
  function showReceipt(record) {
    dialog.replaceChildren(node('h2',names[record.supplier]),node('p',`Ordine ${record.id} · ${record.day}`));
    for(const item of record.items)dialog.append(node('p',`${item.quantity??item.qty??1} × ${item.name}${item.details?' · '+item.details:''}`));
    dialog.append(node('p',record.notes||''),node('strong',`Totale ${euros(record.total)}`),node('p','Riepilogo locale della conferma utente. Non attesta pagamento, accettazione del fornitore o raggiungimento della soglia Russo.'),button('Condividi / copia riepilogo per colleghi',()=>{const b=dialog.querySelector('[data-copy-receipt]');window.DoseCheckout?.copy(b,record);}),button('Chiudi',()=>dialog.close()));const copy=dialog.querySelectorAll('button')[0];copy.dataset.copyReceipt='';copy.setAttribute('aria-live','polite');dialog.insertBefore(node('p',window.DoseCheckout?.summary(record)||''),copy);dialog.showModal();
  }
  function refreshReceipts(){
    const records=P.today(uid);receipts.hidden=!records.length;receipts.replaceChildren();
    for(const record of records){
      const late=record.supplier==='pagnottella'&&new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(record.timestamp))>'11:00';
      receipts.append(node('h2','Oggi hai ordinato'),node('p',`Da ${names[record.supplier]}: ${record.summary} · Totale: ${euros(record.total)} — Consegna prevista: ore 13:00${late?' (non garantita per ordini dopo le 11:00)':''}`),button('Vedi dettagli ricevuta',()=>showReceipt(record)));
    }
    if(records.length)receipts.append(node('small','Conferme utente salvate su questo browser; non costituiscono conferma del fornitore o ricevuta di pagamento.'));
  }
  function refresh(){
    mount();refreshNote();refreshReceipts();
    if(!supplier)return;
    const empty=adapter()?.empty()===true,list=P.favorites(uid,supplier);
    host.hidden=!uid||!empty;
    const old=document.getElementById(supplier==='russo'?'russo-usual':'usual-order');if(old&&uid)old.hidden=true;
    const next=JSON.stringify([uid,empty,list]);if(next===signature)return;signature=next;
    host.replaceChildren(node('h2','I miei preferiti'),node('small','Fino a 3 combinazioni personali, salvate su questo browser.'));
    list.forEach((favorite,index)=>{
      const row=node('div');row.className='dose-favorite-slot';const label=node('input');label.value=favorite.label;label.maxLength=60;label.setAttribute('aria-label',`Nome preferito ${index+1}`);
      row.append(label,button('Rinomina',()=>{P.saveFavorite(uid,supplier,favorite,label.value,index);signature='';refresh();}),button('Ripeti',()=>{
        if(!adapter()?.empty())throw Error('Svuota il carrello prima di richiamare un preferito.');
        const message=adapter().repeat(favorite);refresh();status.textContent=message||'Combinazione ripristinata ai prezzi attuali. Verifica prima di inviare.';
      }),button('Elimina',()=>{P.removeFavorite(uid,supplier,index);signature='';refresh();}));host.append(row);
    });
    for(let i=list.length;i<3;i++)host.append(node('p',`Slot ${i+1} libero: componi il carrello e salva una combinazione.`));
    // Status stays visible even when repeating hides the empty-cart panel.
    if(!status.parentNode)host.after(status);
  }
  window.DoseUX={refresh};
  window.addEventListener('dose:preferences-ready',refresh);
  window.addEventListener('dose:order-recorded',()=>setTimeout(refreshReceipts,0));
  window.addEventListener('storage',()=>{signature='';refresh();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  refresh();
  setInterval(refreshReceipts,60000);
  try{
    const access=window.DoseSupplierAccess;
    if(access?.isTrustedLocalContext?.()) {
      const syncLocal=()=>{const next=access.getStoredUser?.()?.uid || null;if(next!==uid){uid=next;signature='';if(dialog.open)dialog.close();refresh();}};
      syncLocal();
      window.addEventListener('pagnottella:session-changed',syncLocal);
      window.addEventListener('storage',syncLocal);
      new MutationObserver(syncLocal).observe(document.body,{attributes:true,attributeFilter:['class']});
      return;
    }
    const core=await access.ensureFirebase();
    const {onAuthStateChanged}=await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js');
    onAuthStateChanged(core.auth,user=>{uid=user&&!user.isAnonymous&&user.emailVerified?user.uid:null;signature='';if(dialog.open)dialog.close();refresh();});
  }catch{status.textContent='Accedi per visualizzare preferiti e ricevute locali.';}
})();
