(() => {
  function byId(id){ return document.getElementById(id); }
  function polishSponsorCopy(){
    const eyebrow = document.querySelector('.authGateEyebrow');
    if(eyebrow) eyebrow.textContent = 'Anteprima riservata';
    const gateTitle = document.querySelector('.authGateCard h3');
    if(gateTitle) gateTitle.textContent = 'Revisione catalogo La Pagnottella Gourmet.';
    const subtitle = byId('brand-subtitle');
    if(subtitle) subtitle.textContent = 'Suite DOSepranza · Anteprima riservata';
    const intro = document.querySelector('.landingCopy > p');
    if(intro) intro.textContent = 'Anteprima riservata per consultare menu, carrello e riepilogo WhatsApp.';
    const badge = byId('preview-order-badge');
    if(badge){ badge.textContent = 'Anteprima riservata'; badge.onclick = null; }
  }
  function polishCheckout(){
    const label = byId('sendOrderLabel');
    if(label && !['Salvataggio ordine...', 'Ordini sospesi durante la chiusura'].includes(label.textContent)) label.textContent = 'Finalizza l’ordine tramite il suo invio su WhatsApp';
    const send = byId('sendOrderBtn');
    if(send) send.setAttribute('aria-label', 'Finalizza l’ordine tramite il suo invio su WhatsApp');
  }
  function paymentHeading(text){
    const el = document.createElement('div');
    el.className = 'paymentGroupTitle';
    el.textContent = text;
    return el;
  }
  function polishPayments(){
    const options = byId('paymentOptions');
    if(!options || options.dataset.sponsorPolished === '1') return;
    const labels = Array.from(options.querySelectorAll('.paymentOption'));
    if(!labels.length) return;
    const firstActive = labels.find(label => !label.classList.contains('isDisabled'));
    const firstDisabled = labels.find(label => label.classList.contains('isDisabled'));
    if(firstActive) options.insertBefore(paymentHeading('Disponibili ora'), firstActive);
    if(firstDisabled) options.insertBefore(paymentHeading('In attivazione'), firstDisabled);
    options.dataset.sponsorPolished = '1';
  }
  function polishProducts(){
    document.querySelectorAll('.card.imageFallback .pic').forEach(pic => {
      if(!pic.querySelector('.previewImageFallbackText')){
        const text = document.createElement('div');
        text.className = 'previewImageFallbackText';
        text.textContent = 'Foto prodotto in aggiornamento';
        pic.appendChild(text);
      }
    });
  }
  function run(){ polishSponsorCopy(); polishCheckout(); polishPayments(); polishProducts(); }
  setTimeout(run, 150);
  setTimeout(run, 500);
  setTimeout(run, 1100);
  setTimeout(run, 1800);
  const grid = byId('grid');
  if(grid) new MutationObserver(run).observe(grid, { childList:true, subtree:true });
  document.addEventListener('change', run, true);
  document.addEventListener('click', () => setTimeout(run, 150), true);
})();
