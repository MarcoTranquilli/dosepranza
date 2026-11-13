(function(root){
  'use strict';
  let dialog;
  function mount(host, cents){
    if(!host || !root.DosePranzaSatispayStock)return;
    const api=root.DosePranzaSatispayStock;
    const payload=api.buildSatispayPayload({recipientId:host.dataset.satispayRecipient,amountCents:cents});
    const key=JSON.stringify(payload);
    if(host.dataset.paymentKey===key)return;
    host.dataset.paymentKey=key;
    if(dialog?.open){dialog.close();dialog.remove();dialog=null;}
    host.replaceChildren();host.classList.add('dose-payment-actions');
    const copy=document.createElement('button');copy.type='button';copy.textContent='Copia importo';copy.disabled=!(payload.amountCents>0);
    copy.onclick=async()=>{try{await navigator.clipboard.writeText((payload.amountCents/100).toFixed(2).replace('.',','));copy.textContent='Importo copiato';}catch{copy.textContent='Importo: '+payload.formattedAmount;}};
    host.append(copy);
    if(!payload.ready)return;
    const link=document.createElement('a');link.href=payload.deepLink;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Apri Satispay ('+payload.formattedAmount+')';host.append(link);
    const qr=document.createElement('button');qr.type='button';qr.textContent='Mostra QR';host.append(qr);
    qr.onclick=()=>{
      try{
        dialog?.remove();dialog=document.createElement('dialog');dialog.className='dose-payment-dialog';dialog.setAttribute('aria-label','Pagamento Satispay');
        const heading=document.createElement('h3');heading.textContent='Satispay · '+payload.formattedAmount;
        const graphic=document.createElement('div');graphic.innerHTML=api.renderQrCodeSvg(payload.deepLink,{size:294});
        const recipient=document.createElement('p');recipient.textContent='Destinatario: '+payload.recipientId;
        const note=document.createElement('p');note.textContent='Controlla destinatario e importo nell’app. L’apertura non conferma il pagamento né l’invio dell’ordine.';
        const close=document.createElement('button');close.type='button';close.textContent='Chiudi';close.onclick=()=>dialog.close();
        dialog.append(heading,graphic,recipient,note,close);document.body.append(dialog);
        dialog.addEventListener('close',()=>qr.focus(),{once:true});
        dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
        dialog.showModal();close.focus();
      }catch{qr.textContent='QR non disponibile: usa Apri Satispay';dialog?.remove();}
    };
  }
  root.DoseSatispayUI={mount};
})(globalThis);
