(function(root){
  'use strict';
  function clock(){
    let anchor=null,offset=0;
    function accept(header,start=Date.now(),end=Date.now()){
      const server=Date.parse(header),rtt=end-start;
      if(!Number.isFinite(server)||rtt<0||rtt>10000)return false;
      offset=server+(rtt/2)-end;
      try{anchor={server:end+offset,mono:root.performance.now()};}catch{anchor=null;}
      return true;
    }
    function now(){try{if(anchor)return anchor.server+root.performance.now()-anchor.mono;}catch{}return Date.now()+offset;}
    async function sync(){try{
      const url=new URL(root.location.href);url.search='clock='+Date.now();url.hash='';
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000),start=Date.now();
      try{const res=await root.fetch(url.href,{method:'HEAD',cache:'no-store',credentials:'same-origin',signal:controller.signal});return res.ok&&accept(res.headers.get('Date'),start,Date.now());}finally{clearTimeout(timer);}
    }catch{return false;}}
    return {accept,now,sync,get offset(){return offset;}};
  }
  function countdown(date,cutoff){
    const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',hourCycle:'h23',hour:'2-digit',minute:'2-digit',second:'2-digit'}).formatToParts(date);
    const n=type=>Number(p.find(x=>x.type===type).value),[h,m]=cutoff.split(':').map(Number);
    const remaining=h*3600+m*60-(n('hour')*3600+n('minute')*60+n('second'));
    return {remaining:Math.max(0,remaining),visible:remaining<=1200&&remaining>0,closed:remaining<=0,text:`${String(Math.floor(Math.max(0,remaining)/60)).padStart(2,'0')}:${String(Math.max(0,remaining)%60).padStart(2,'0')}`};
  }
  function summary(record){
    const names={russo:'Alimentari Russo',pagnottella:'Pagnottella Gourmet'};
    const items=(record.items||[]).map(i=>`${i.quantity??i.qty??1}x ${i.name}${i.details||i.opt?' ('+(i.details||i.opt)+')':''}`).join(', ');
    const amount=new Intl.NumberFormat('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2}).format(record.total);
    return `Oggi ho ordinato da ${names[record.supplier]||record.supplier}: ${items} · Totale €${amount} via ${record.paymentMethod||'metodo non indicato'}.`;
  }
  async function copy(button,record){
    if(button.disabled)return false;
    const label=button.textContent;button.disabled=true;
    try{
      if(root.DosePranzaClientUX){
        const result=await root.DosePranzaClientUX.shareOrCopyReceipt({title:'Ricevuta DOSepranza',text:summary(record)});
        if(result.method==='aborted'){button.textContent=label;return false;}
        if(!result.ok)throw Error();
        button.textContent=result.method==='share'?'Riepilogo condiviso':'✓ Copiato negli appunti!';return true;
      }
      if(typeof root.navigator?.clipboard?.writeText!=='function')throw Error();await root.navigator.clipboard.writeText(summary(record));button.textContent='✓ Copiato negli appunti!';return true;}
    catch{button.textContent='Copia non disponibile. Seleziona il riepilogo.';return false;}
    finally{setTimeout(()=>{button.textContent=label;button.disabled=false;},2500);}
  }
  root.DoseCheckout={clock,countdown,summary,copy};
  root.DoseClock=clock();
  if(typeof document==='undefined')return;
  const mount=()=>{
    root.DoseClock.sync();
    const supplier=root.location.pathname.includes('/russo/')?'russo':root.location.pathname.includes('pagnottella')?'pagnottella':null;
    if(!supplier)return;
    const banner=document.createElement('aside');banner.className='dose-cutoff-banner';banner.hidden=true;banner.setAttribute('aria-label','Tempo indicativo per ordinare');
    const anchor=document.querySelector('main')||document.body;anchor.prepend(banner);
    const tick=()=>{
      const state=countdown(new Date(root.DoseClock.now()),supplier==='russo'?'10:30':'11:00');
      banner.hidden=!state.visible&&!state.closed;
      banner.textContent=state.closed?(supplier==='russo'?'Ordini chiusi per oggi':'Dopo le 11:00 la consegna entro le 13:00 non è garantita'):'Rimangono '+state.text+' per ordinare';
      let local=false;try{local=root.DoseSupplierAccess?.isE2E?.()===true;}catch{}
      if(state.closed&&supplier==='russo'&&!local)document.querySelectorAll('[data-action="send-order"]').forEach(button=>{button.disabled=true;});
    };
    tick();const timer=setInterval(tick,1000);root.addEventListener?.('pagehide',()=>clearInterval(timer),{once:true});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(typeof window==='undefined'?globalThis:window);
