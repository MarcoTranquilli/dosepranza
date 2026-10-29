(() => {
  const menu = document.getElementById('menu-view');
  const cart = document.getElementById('cart-view');
  if (!menu || !cart || document.getElementById('order-workspace')) return;

  const workspace = document.createElement('div');
  workspace.id = 'order-workspace';
  workspace.className = 'order-workspace';
  menu.before(workspace);
  workspace.append(menu, cart);
  workspace.closest('main')?.parentElement?.classList.add('russo-workspace-shell');

  menu.classList.add('catalog-column');
  cart.classList.add('cart-column');
  cart.setAttribute('role', 'region');
  cart.setAttribute('aria-label', 'Carrello ordini');

  // Backdrop scrim per mobile
  const scrim = document.createElement('div');
  scrim.id = 'russo-cart-scrim';
  scrim.className = 'russo-cart-scrim';
  scrim.setAttribute('aria-hidden', 'true');
  workspace.appendChild(scrim);

  // Maniglia visuale per il bottom-sheet
  const handle = document.createElement('div');
  handle.className = 'russo-cart-handle';
  handle.setAttribute('aria-hidden', 'true');

  const slot = document.createElement('div');
  slot.id = 'personal-lunch-card-container';
  menu.prepend(slot);

  const details = document.createElement('div');
  details.id = 'russo-cart-details';
  details.append(...cart.childNodes);

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.id = 'cart-mobile-toggle';
  toggle.className = 'cart-mobile-toggle';
  toggle.setAttribute('aria-controls', details.id);

  const label = document.createElement('span');
  label.className = 'cart-toggle-label';

  const summary = document.createElement('strong');
  summary.id = 'russo-cart-dock-summary';
  summary.setAttribute('aria-live', 'polite');
  summary.setAttribute('aria-atomic', 'true');
  summary.textContent = '0 articoli · €0,00';

  toggle.append(label, summary);
  cart.append(handle, toggle, details);

  const mobile = matchMedia('(max-width: 899px)');

  function expand(open) {
    const isExpanded = !!open;
    cart.classList.toggle('is-expanded', isExpanded);
    toggle.setAttribute('aria-expanded', String(isExpanded));
    label.textContent = isExpanded ? 'Chiudi carrello' : 'Apri carrello';
    details.hidden = mobile.matches && !isExpanded;
    scrim.classList.toggle('is-active', mobile.matches && isExpanded);

    if (mobile.matches) {
      cart.setAttribute('aria-modal', isExpanded ? 'true' : 'false');
    } else {
      cart.removeAttribute('aria-modal');
    }
  }

  toggle.addEventListener('click', () => expand(!cart.classList.contains('is-expanded')));

  scrim.addEventListener('click', () => {
    if (mobile.matches && cart.classList.contains('is-expanded')) {
      expand(false);
      toggle.focus();
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && mobile.matches && cart.classList.contains('is-expanded')) {
      event.preventDefault();
      expand(false);
      toggle.focus();
    }
  });

  const observer = new MutationObserver(() => {
    workspace.classList.toggle('is-ordering', menu.classList.contains('active') || cart.classList.contains('active'));
    if (cart.classList.contains('active')) expand(true);
    else if (menu.classList.contains('active')) expand(false);
  });
  observer.observe(menu, { attributes: true, attributeFilter: ['class'] });

  let wasActive = cart.classList.contains('active');
  new MutationObserver(() => {
    const active = cart.classList.contains('active');
    if (active === wasActive) return;
    wasActive = active;
    workspace.classList.toggle('is-ordering', menu.classList.contains('active') || active);
    expand(active);
  }).observe(cart, { attributes: true, attributeFilter: ['class'] });

  mobile.addEventListener('change', () => expand(cart.classList.contains('is-expanded')));
  workspace.classList.toggle('is-ordering', menu.classList.contains('active') || wasActive);
  expand(wasActive);
})();
