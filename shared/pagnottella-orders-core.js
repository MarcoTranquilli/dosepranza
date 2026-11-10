(() => {
  const allowedEmails = new Set(['commerciale@lapagnottellagourmet.it','isidorovagnozzi@gmail.com','marco.tranquilli@dos.design','marta.diamantini@dos.design','luca.pacella@dos.design']);
  const allowed = user => Boolean(user && !user.isAnonymous && user.emailVerified && user.providerData?.some(p=>p.providerId==='google.com') && allowedEmails.has(user.email));
  const quantity = i => Number.isSafeInteger(i.quantity ?? i.qty) && (i.quantity ?? i.qty)>0 ? (i.quantity ?? i.qty) : 0;
  const composition = i => [i.name,i.baseDescription,i.option || i.details,...(i.extras||[]).map(e=>typeof e==='string'?e:e.name)].filter(Boolean).join(' · ');
  function packing(orders){
    const groups={bread:new Map(),recipes:new Map(),extras:new Map()};
    const add=(map,key,n)=>{if(key&&n)map.set(key,(map.get(key)||0)+n);};
    for(const o of orders)for(const i of o.items||[]){const n=quantity(i);add(groups.bread,i.option || 'Pane/base non specificato',n);add(groups.recipes,[i.name,i.baseDescription].filter(Boolean).join(' · '),n);for(const e of i.extras||[])add(groups.extras,typeof e==='string'?e:e.name,n);}
    return groups;
  }
  function plan(saved,products,optionList,extras){
    if(!saved || !Array.isArray(saved.items) || !saved.items.length)throw Error('Configurazione non disponibile');
    return saved.items.map(i=>{
      const p=products.find(p=>p.id===i.id&&p.isActive!==false),q=quantity(i);
      const option=p&&optionList(p).find(o=>o.label===i.option);
      if(!p||!option||!q||q>100||(i.baseDescription && i.baseDescription!==p.desc))throw Error('Ricetta o pane non piu disponibile: scegli dal catalogo');
      const selected=(i.extras||[]).map(e=>extras.find(x=>x.name===(typeof e==='string'?e:e.name)));
      if(selected.some(e=>!e)||(selected.length&&p.supportsExtras!==true))throw Error('Extra non piu disponibile: scegli dal catalogo');
      return {product:p,option,extras:selected,qty:q};
    });
  }
  globalThis.DosePagnottellaOrders={allowed,quantity,composition,packing,plan};
})();
