(function(root){
 const managers=['marco.tranquilli@dos.design','marta.diamantini@dos.design','luca.pacella@dos.design'];
 const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 const parts=d=>Object.fromEntries(fmt.formatToParts(d).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
 function day(d=new Date()){const p=parts(d);return `${p.year}-${p.month}-${p.day}`;}
 function midnight(s){const target=Date.parse(s+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(target)||new Date(target).toISOString().slice(0,10)!==s)throw Error('Data non valida');let t=target;for(let i=0;i<5;i++){const p=parts(new Date(t)),r=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);if(r===target)return new Date(t);t+=target-r;}throw Error('Data non valida');}
 function range(s){const next=new Date(Date.parse(s+'T12:00:00Z')+86400000).toISOString().slice(0,10);return {start:midnight(s),end:midnight(next)};}
 function open(supplier,now=new Date()){const p=parts(now);return `${p.hour}:${p.minute}`<(supplier==='russo'?'10:30':'11:00');}
 function manager(email){return managers.includes(String(email||'').toLowerCase());}
 function reconcile(items,catalog){
  if(!Array.isArray(items)||!items.length)throw Error('Ordine senza prodotti');
  return items.map(i=>{const p=catalog.find(p=>String(p.id)===String(i.id));const qty=i.quantity??i.qty??1;
   if(!p||p.available===false||!Number.isFinite(p.price)||p.price<0||!Number.isInteger(qty)||qty<1||qty>50)throw Error('Prodotto non disponibile o quantità non valida: ricomponi dal catalogo');
   return {item:i,product:p,qty};});
 }
 root.DoseCustomerCore={day,range,open,manager,reconcile};
})(typeof window==='undefined'?globalThis:window);
