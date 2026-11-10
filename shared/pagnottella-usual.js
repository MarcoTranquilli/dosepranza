(() => {
 const KEY='pg_last_completed_order',el=id=>document.getElementById(id);
 const user=()=>window.DoseSupplierAccess?.getStoredUser?.();
 function read(){try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');return saved?.uid&&saved.uid===user()?.uid?saved:null;}catch{return null;}}
 function refresh(){const card=el('usual-order');if(!card)return;const saved=read();card.hidden=!saved||!window.DoseUsualCart?.empty();if(!card.hidden)el('usual-summary').textContent=`Il tuo solito: ${saved.summary}`;}
 function save(payload){try{const uid=user()?.uid;if(!uid)return;const items=payload.items.map(i=>({id:i.id,name:i.name,baseDescription:i.baseDescription,option:i.option,quantity:i.quantity,extras:i.extras}));const saved={uid,items,bread:items.map(i=>i.option),ingredients:items.flatMap(i=>[i.baseDescription || i.name,...(i.extras||[]).map(e=>e.name)]),notes:payload.allergies||'',summary:items.map(i=>`${i.option} · ${i.baseDescription || i.name}${i.extras.length?' · '+i.extras.map(e=>e.name).join(', '):''}`).join('; '),timestamp:new Date().toISOString()};localStorage.setItem(KEY,JSON.stringify(saved));}catch{console.warn('usual_order_storage_unavailable');}}
 window.DoseUsualOrder={save,refresh};
 el('usual-repeat')?.addEventListener('click',()=>{const saved=read();if(!saved)return;try{window.DoseUsualCart.repeat(saved);el('usual-status').textContent='Configurazione ripristinata ai prezzi attuali. Controlla e conferma il tuo ordine.';}catch(e){el('usual-status').textContent=e.message||'Seleziona nuovamente dal catalogo.';}});
 window.addEventListener('pagnottella:session-changed',refresh);
})();
