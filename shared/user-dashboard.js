(async function(){
  'use strict';
  const E=window.DoseExpenses,B=window.DoseDailyBoard;
  const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
  const money=value=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(value/100);
  const main=document.querySelector('main');if(!main||!E||!B)return;
  const expenses=node('details'),headline=node('summary','Spesa personale'),content=node('div'),status=node('p');expenses.className='dose-ux dose-expenses';expenses.hidden=true;status.setAttribute('role','status');expenses.append(headline,content,status);main.prepend(expenses);
  const hub=!location.pathname.includes('/russo/')&&!location.pathname.includes('pagnottella');
  const board=node('details'),boardTitle=node('summary','Chi ha gia ordinato?'),boardList=node('ul'),boardStatus=node('p');board.className='dose-ux dose-board';board.hidden=true;boardStatus.setAttribute('role','status');board.append(boardTitle,boardStatus,boardList);if(hub)expenses.after(board);
  let sdk,core,user,epoch=0,stop,boardDay='',periodDay='',pending=[];
  function reset(){++epoch;stop?.();stop=null;boardDay='';content.replaceChildren();status.textContent='';boardList.replaceChildren();boardStatus.textContent='';expenses.hidden=true;board.hidden=true;}
  async function refresh(){
    if(!B.allowed(user)||!sdk)return;
    const ticket=epoch,current=user;expenses.hidden=false;status.textContent='Caricamento del tuo riepilogo...';
    try{
      const {data,source}=await E.load(core.db,sdk,current.uid);
      if(ticket!==epoch)return;
      const month=data.month;
      headline.textContent=`Questo mese: ${month.count} ordini confermati (${money(month.cents)})`;
      content.replaceChildren(node('p',`Russo: ${money(month.russo.cents)} (${month.russo.count}) · Pagnottella: ${money(month.pagnottella.cents)} (${month.pagnottella.count})`),node('p',`Media per ordine: ${money(month.averageCents)} · Questa settimana: ${data.week.count} ordini (${money(data.week.cents)})`),node('small',`Valore ordinato confermato, non incasso verificato. ${data.pending} ordini nel periodo non ancora marcati CONFIRMED, esclusi dai totali. ${data.malformed} record non validi esclusi.`));
      status.textContent=source==='session'?'Riepilogo dalla sessione, valido al massimo 15 minuti.':'Aggiornato dal server.';
    }catch{if(ticket===epoch){content.replaceChildren();headline.textContent='Spesa personale';status.textContent='Riepilogo non disponibile. Verifica connessione e permessi, poi riprova.';}}
  }
  const retry=node('button','Aggiorna riepilogo');retry.type='button';retry.addEventListener('click',()=>{if(user){E.invalidate(user.uid);refresh();}});expenses.append(retry);
  function watchBoard(){
    const day=E.day(),hour=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
    const visible=hub&&B.allowed(user)&&hour<'11:00';board.hidden=!visible;
    if(!visible){stop?.();stop=null;boardDay='';return;}
    if(boardDay===day)return;stop?.();boardDay=day;boardList.replaceChildren();boardStatus.textContent='Caricamento presenze...';const ticket=epoch;
    stop=sdk.onSnapshot(sdk.doc(core.db,'daily_summaries',day),{includeMetadataChanges:true},snapshot=>{
      if(ticket!==epoch||boardDay!==day)return;
      const people=B.people(snapshot.exists()?snapshot.data().participants:[]);
      boardTitle.textContent=`Oggi hanno gia ordinato ${people.length} colleghi · Espandi lista`;
      boardList.replaceChildren(...people.map(person=>node('li',`${person.name} · ${person.suppliers.map(s=>s==='russo'?'Russo':'Pagnottella').join(', ')}`)));
      boardStatus.textContent=snapshot.metadata.fromCache?'Presenze dalla cache: in attesa di sincronizzazione.':'Presenze dichiarate dagli utenti. Nessun dettaglio di ordini o pagamenti.';
    },()=>{if(ticket===epoch){boardList.replaceChildren();boardTitle.textContent='Presenze non disponibili';boardStatus.textContent='Verifica connessione e abilitazione delle nuove Rules.';}});
  }
  async function drain(){
    if(!sdk||!B.allowed(user))return;
    const queued=pending;pending=[];const ticket=epoch,current=user;
    for(const event of queued){if(event.uid!==current.uid)continue;
      try{await B.publish(core.db,sdk,current,event);}catch{if(ticket===epoch)status.textContent='Ordine salvato; presenza in bacheca non aggiornata. Nessun reinvio dell’ordine necessario.';}
    }
  }
  window.addEventListener('dose:order-recorded',event=>{
    const detail=event.detail;if(!detail?.uid)return;E.invalidate(detail.uid);pending.push(detail);
    if(user?.uid===detail.uid){refresh();drain();}
  });
  window.addEventListener('storage',event=>{if(user&&event.key?.startsWith(`dose_ux_v1:${encodeURIComponent(user.uid)}:`)){E.invalidate(user.uid);refresh();}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&user){refresh();watchBoard();}});
  // Only production Firebase identities access these widgets; demo mode never reads cloud data.
  if(window.DoseSupplierAccess?.isTrustedLocalContext?.())return;
  try{
    const ready=await window.DoseSupplierAccess.ensureFirebase();
    const [{onAuthStateChanged},firestore]=await Promise.all([import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js')]);
    sdk=firestore;core={...ready,db:ready.db||sdk.getFirestore(ready.app)};
    onAuthStateChanged(core.auth,next=>{reset();user=next;if(!B.allowed(user)){pending=[];return;}periodDay=E.day();refresh();watchBoard();drain();});
    setInterval(()=>{if(!user)return;if(periodDay!==E.day()){periodDay=E.day();E.invalidate(user.uid);refresh();}watchBoard();},60000);
  }catch{expenses.hidden=false;status.textContent='Accedi per consultare il riepilogo personale.';}
})();
