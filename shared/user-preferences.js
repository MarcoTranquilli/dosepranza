(function(root) {
  'use strict';
  const labels = {veg:'Vegetariano','lactose-free':'Senza lattosio',hot:'Caldo / Da scaldare',light:'Fit / Leggero'};
  const romeDay = (date = new Date()) => new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
  function tags(product) {
    const explicit = [...(Array.isArray(product.foodTags)?product.foodTags:[]), ...(Array.isArray(product.tags)?product.tags:[])].filter(tag => Object.hasOwn(labels,tag));
    const diets = [...(Array.isArray(product.diet)?product.diet:[]),product.dietType];
    if(diets.some(diet => ['vegetariano','vegano','vegetariana','vegana','vegetarian','vegan'].includes(diet))) explicit.push('veg');
    return [...new Set(explicit)];
  }
  const matches = (product,tag) => !tag || tag === 'all' || tags(product).includes(tag);
  const key = (uid,suffix) => `dose_ux_v1:${encodeURIComponent(uid)}:${suffix}`;
  function read(keyName,fallback=null) { try {return JSON.parse(localStorage.getItem(keyName)) ?? fallback;} catch {return fallback;} }
  function write(keyName,value) {try {localStorage.setItem(keyName,JSON.stringify(value));return true;} catch {return false;} }
  function combination(value) {
    if(!value || !Array.isArray(value.items) || !value.items.length || value.items.length>150) return null;
    if(value.items.some(item=>!item || typeof item.name!=='string' || !item.name.trim() || !['string','number'].includes(typeof item.id) || !Number.isInteger(item.quantity??item.qty??1) || (item.quantity??item.qty??1)<1 || (item.quantity??item.qty??1)>100)) return null;
    return {items:JSON.parse(JSON.stringify(value.items)),notes:String(value.notes??value.allergies??'').slice(0,2000),summary:value.items.map(item=>item.name).join(' + ').slice(0,1000)};
  }
  function favorites(uid,supplier) {
    if(!uid) return [];
    const saved=read(key(uid,`${supplier}:favorites`));
    if(Array.isArray(saved)) return saved.filter(item=>combination(item)&&typeof item.label==='string').slice(0,3);
    const legacyKeys=supplier==='russo'?['russo_last_completed_order']:['pg_last_completed_order','pagnottella_last_completed_order'];
    for(const legacyKey of legacyKeys) {
      const old=read(legacyKey),valid=combination(old);
      if(valid && (old.userId??old.uid)===uid) {
        const migrated=[{...valid,label:'Il solito'}];write(key(uid,`${supplier}:favorites`),migrated);return migrated;
      }
    }
    return [];
  }
  function saveFavorite(uid,supplier,payload,label,index=null) {
    if(!uid) throw Error('Accedi per salvare un preferito.');
    const valid=combination(payload),name=String(label||'').trim().slice(0,60);
    if(!valid || !name) throw Error('Inserisci una combinazione valida e un nome.');
    const list=favorites(uid,supplier);
    if(index===null) {if(list.length>=3) throw Error('Hai gia 3 preferiti: elimina uno slot prima di salvarne un altro.');list.push({...valid,label:name});}
    else {if(!Number.isInteger(index)||!list[index]) throw Error('Preferito non disponibile.');list[index]={...valid,label:name};}
    if(!write(key(uid,`${supplier}:favorites`),list)) throw Error('Memoria locale non disponibile: preferito non salvato.');
    return list;
  }
  function removeFavorite(uid,supplier,index) {
    if(!uid) return;
    const list=favorites(uid,supplier);list.splice(index,1);
    if(!write(key(uid,`${supplier}:favorites`),list)) throw Error('Impossibile salvare la modifica.');
  }
  const note = (uid,supplier) => {const value=uid?read(key(uid,`${supplier}:note`),''):'';return typeof value==='string'?value:'';};
  function saveNote(uid,supplier,text) {return !!uid && (!String(text).trim() || write(key(uid,`${supplier}:note`),String(text).trim().slice(0,2000)));}
  function receipt(uid,supplier,id,payload,confirmed=true) {
    try {
    const valid=combination(payload);
    if(!uid||!id||!valid||!Number.isFinite(payload.total)||payload.total<=0) return false;
    const record={...valid,uid,supplier,id,total:payload.total,timestamp:new Date().toISOString(),day:romeDay(),confirmed};
    const suffix=confirmed?'receipts':'pending';
    const records=read(key(uid,suffix),[]);
    return write(key(uid,suffix),[...(Array.isArray(records)?records:[]).filter(r=>r&&r.day===record.day&&r.id!==id),record].slice(-30));
    } catch {return false;}
  }
  function confirmReceipt(uid,id) {
    try {
    if(!uid) return;
    const pending=read(key(uid,'pending'),[]);
    const record=Array.isArray(pending)&&pending.find(r=>r&&r.id===id&&r.uid===uid&&r.day===romeDay());
    if(record) receipt(uid,record.supplier,id,record,true);
    } catch {return false;}
  }
  function today(uid,date=new Date()) {
    const records=uid?read(key(uid,'receipts'),[]):[];
    return Array.isArray(records)?records.filter(r=>r&&r.uid===uid&&r.confirmed===true&&r.day===romeDay(date)&&Number.isFinite(Date.parse(r.timestamp))&&romeDay(new Date(r.timestamp))===r.day&&['russo','pagnottella'].includes(r.supplier)&&combination(r)&&Number.isFinite(r.total)&&r.total>0):[];
  }
  root.DosePreferences={labels,tags,matches,romeDay,combination,favorites,saveFavorite,removeFavorite,note,saveNote,receipt,confirmReceipt,today};
})(typeof window==='undefined'?globalThis:window);
