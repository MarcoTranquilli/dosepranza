const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('pagnottella-gourmet/pagnottella.js','utf8');
function fn(name){
  const match=source.match(new RegExp(`(?:async )?function ${name}\\([^\\n]*`));
  assert.ok(match,name);
  const start=match.index;
  if(match[0].endsWith('}')) return match[0];
  return source.slice(start,source.indexOf('\n}',start)+2);
}
for(const file of ['supplier-access.js','pagnottella-gourmet/supplier-access.js']){
  test(`${file} exports real async Firebase initializer`,()=>{
    const context=vm.createContext({window:{location:{hostname:'example.test',protocol:'https:',search:''}},URLSearchParams,console});
    vm.runInContext(fs.readFileSync(file,'utf8'),context);
    assert.equal(typeof context.window.DoseSupplierAccess.ensureFirebase,'function');
    assert.equal(context.window.DoseSupplierAccess.ensureFirebase.constructor.name,'AsyncFunction');
  });
}
function cartContext(){
  const storage=new Map();
  const ctx=vm.createContext({state:{cart:{}},PRODUCTS:[{id:'p',name:'Panino',price:7,isActive:true}],DATA:{extras:[]},
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    console:{warn(){}},toast(){},optionList:()=>[{label:'Standard',extra:0}],isOrderingClosed:()=>false,
    resetCurrentTransmissionState(){},renderCart(){}});
  vm.runInContext(`const DRAFT_CART_KEY='pg_draft_cart';\n${['persistDraftCart','restoreDraftCart','clearDraftCart','addToCart','changeQty'].map(fn).join('\n')}`,ctx);
  return {ctx,storage};
}
test('anonymous add/quantity survives reload and uses current catalog prices',()=>{
  const {ctx,storage}=cartContext();
  vm.runInContext("addToCart(PRODUCTS[0],{label:'Standard',extra:0});changeQty('p|Standard',1)",ctx);
  assert.equal(JSON.parse(storage.get('pg_draft_cart'))['p|Standard'].qty,2);
  ctx.state.cart={};ctx.PRODUCTS[0].price=8;
  vm.runInContext('restoreDraftCart()',ctx);
  assert.equal(ctx.state.cart['p|Standard'].qty,2);
  assert.equal(ctx.state.cart['p|Standard'].originalUnit,8);
  vm.runInContext("changeQty('p|Standard',-2)",ctx);
  assert.equal(storage.get('pg_draft_cart'),'{}');
});
test('corrupt and obsolete drafts do not crash or restore unavailable products',()=>{
  const {ctx,storage}=cartContext();
  storage.set('pg_draft_cart','invalid');
  assert.doesNotThrow(()=>vm.runInContext('restoreDraftCart()',ctx));
  storage.set('pg_draft_cart',JSON.stringify({x:{id:'removed',qty:1,extras:[]}}));
  vm.runInContext('restoreDraftCart()',ctx);
  assert.equal(Object.keys(ctx.state.cart).length,0);
});
test('storage denial preserves live cart; explicit clear removes saved draft',()=>{
  const {ctx,storage}=cartContext();
  vm.runInContext("addToCart(PRODUCTS[0],{label:'Standard',extra:0})",ctx);
  vm.runInContext('clearDraftCart()',ctx);
  assert.equal(storage.has('pg_draft_cart'),false);
  ctx.localStorage.setItem=()=>{throw Error('QuotaExceededError');};
  assert.doesNotThrow(()=>vm.runInContext("changeQty('p|Standard',1)",ctx));
  assert.equal(ctx.state.cart['p|Standard'].qty,2);
});
test('successful remote order remains successful when local log throws',async()=>{
  const elements={confirm:{classList:{add(){},remove(){}}},paymentConfirmConsent:{checked:true}};
  const ctx=vm.createContext({state:{confirmationAction:'submit'},ensureAuthenticated:()=>true,
    pagnottellaOrdersClosed:()=>false,totals:()=>({count:1}),byId:id=>elements[id],closePaymentConfirmation(){},
    buildMessage:()=> 'ordine',checkoutFingerprint:()=> 'fingerprint',whatsappUrl:()=> 'https://wa.me/test',
    window:{open:()=>null,dispatchEvent(){}},setSendBusy(){},buildOrderPayload:()=>({}),
    supplierAccess:{createPagnottellaOrder:async()=>({id:'saved-123',local:false})},
    logOrder(){throw Error('QuotaExceededError');},console:{warn(){}},persistCheckoutState(){},showWhatsAppStatus(){},
    CustomEvent:class {}});
  vm.runInContext(fn('confirmPaymentAndSend'),ctx);
  await vm.runInContext('confirmPaymentAndSend()',ctx);
  assert.equal(ctx.state.lastOrderId,'saved-123');
  assert.equal(ctx.state.lastSubmittedFingerprint,'fingerprint');
  assert.match(elements.confirm.textContent,/registrato/);
  assert.doesNotMatch(elements.confirm.textContent,/Registrazione tecnica non riuscita/);
});
test('only explicit completion/new order clear draft; login does not reset cart',()=>{
  assert.match(fn('completeWhatsappOrder'),/clearDraftCart\(\)/);
  assert.match(fn('newOrder'),/clearDraftCart\(\)/);
  assert.doesNotMatch(fn('signInWithGoogleGate'),/state\.cart\s*=|clearDraftCart/);
  assert.ok(source.indexOf('restoreDraftCart();')<source.indexOf('  renderCart();'));
});
