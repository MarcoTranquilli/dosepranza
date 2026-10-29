(() => {
  const menu = document.getElementById('menu-view');
  const cart = document.getElementById('cart-view');
  if (!menu || !cart || document.getElementById('order-workspace')) return;
  const workspace = document.createElement('div');
  workspace.id = 'order-workspace';
  workspace.className = 'order-workspace';
  menu.before(workspace);
  workspace.append(menu, cart);
  workspace.closest('main')?.parentElement.classList.add('russo-workspace-shell');
  menu.classList.add('catalog-column');
  cart.classList.add('cart-column');
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
  const summary = document.createElement('strong');
  summary.id = 'russo-cart-dock-summary';
  summary.textContent = '0 articoli · €0,00';
  toggle.append(label, summary);
  cart.append(toggle, details);
  const mobile = matchMedia('(max-width: 899px)');
  function expand(open) {
    cart.classList.toggle('is-expanded', open);
    toggle.setAttribute('aria-expanded', String(open));
    label.textContent = open ? 'Chiudi carrello' : 'Apri carrello';
    details.hidden = mobile.matches && !open;
  }
  toggle.addEventListener('click', () => expand(!cart.classList.contains('is-expanded')));
  cart.addEventListener('keydown', event => {
    if (event.key === 'Escape' && mobile.matches) { expand(false); toggle.focus(); }
  });
  const observer = new MutationObserver(() => {
    workspace.classList.toggle('is-ordering', menu.classList.contains('active') || cart.classList.contains('active'));
    if (cart.classList.contains('active')) expand(true);
    else if (menu.classList.contains('active')) expand(false);
  });
  observer.observe(menu, {attributes:true, attributeFilter:['class']});
  // Observe navigation only: expanding the drawer also changes the cart class.
  let wasActive = cart.classList.contains('active');
  new MutationObserver(() => {
    const active = cart.classList.contains('active');
    if (active === wasActive) return;
    wasActive = active;
    workspace.classList.toggle('is-ordering', menu.classList.contains('active') || active);
    expand(active);
  }).observe(cart, {attributes:true, attributeFilter:['class']});
  mobile.addEventListener('change', () => expand(cart.classList.contains('is-expanded')));
  workspace.classList.toggle('is-ordering', menu.classList.contains('active') || wasActive);
  expand(wasActive);
})();
