(() => {
  function byId(id){ return document.getElementById(id); }
  function polishProductionCopy(){
    const eyebrow = document.querySelector('.authGateEyebrow');
    if(eyebrow) eyebrow.textContent = 'Accesso riservato';
    const gateTitle = document.querySelector('.authGateCard h3');
    if(gateTitle) gateTitle.textContent = 'Accedi a La Pagnottella Gourmet.';
    const subtitle = byId('brand-subtitle');
    if(subtitle) subtitle.textContent = 'Suite DOSepranza';
    const intro = document.querySelector('.landingCopy > p');
    if(intro) intro.textContent = 'Consulta il menu, componi il carrello e invia il riepilogo ordine.';
    const badge = byId('preview-order-badge');
    if(badge){ badge.textContent = 'Ordine'; badge.onclick = null; }
  }
  function polishCheckout(){
    const label = byId('sendOrderLabel');
    const send = byId('sendOrderBtn');
    if(!send || send.classList.contains('isBusy') || send.classList.contains('isWhatsAppOpened')) return;
    const currentLabel = label?.textContent?.trim();
    if(currentLabel) send.setAttribute('aria-label', currentLabel);
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
  function run(){ polishProductionCopy(); polishCheckout(); polishPayments(); polishProducts(); }
  setTimeout(run, 150);
  setTimeout(run, 500);
  setTimeout(run, 1100);
  setTimeout(run, 1800);
  const grid = byId('grid');
  if(grid) new MutationObserver(run).observe(grid, { childList:true, subtree:true });
  document.addEventListener('change', run, true);
  document.addEventListener('click', () => setTimeout(run, 150), true);
})();
