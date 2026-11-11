const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const source=fs.readFileSync('pagnottella-gourmet/pagnottella.js','utf8');
function fn(name){const start=source.indexOf(`function ${name}(`);assert.ok(start>=0);return source.slice(start,source.indexOf('\n}',start)+2);}
test('WhatsApp URL safely encodes multiline notes and complex options',()=>{
 const message='2x Panino (Crudo & Brie + Rucola)\nNote: no noci? 50% / grazie #1\nTotale: €12,50';
 const ctx={whatsappConfig:()=>({normalizedNumber:'393921512515'}),message};
 vm.runInNewContext(fn('whatsappUrl')+';url=whatsappUrl(message)',ctx);
 const url=new URL(ctx.url);assert.equal(url.origin,'https://wa.me');assert.equal(url.pathname,'/393921512515');assert.equal(url.searchParams.get('text'),message);assert.equal(url.hash,'');
 assert.match(source,/paymentCardText'\)\.textContent = `\$\{paymentNoteCopy\(\)\}/);
});
test('WhatsApp message includes quantities, options, extras, notes, amount and Rome time',()=>{
 const ctx={totals:()=>({items:[{qty:2,name:'Ciabatta',opt:'Integrale',extras:[{name:'Rucola',price:.5}],originalUnit:5}],total:10}),byId:id=>({value:id==='customer'?'Cliente Test':id==='notes'?'Senza noci':''}),companyCopy:()=> 'DOS',deliverySiteCopy:()=> 'Piano 2',selectedPaymentMethod:()=> 'Contanti al ritiro',currentDate:()=>new Date('2026-11-11T09:15:00Z'),money:n=> '€'+n.toFixed(2),discountedPrice:n=>n,cap:s=>s};
 vm.runInNewContext(fn('buildMessage')+';message=buildMessage()',ctx);
 for(const value of ['2x Ciabatta','Integrale','Rucola','Totale: €10.00','10:15','Contanti al ritiro','Senza noci'])assert.ok(ctx.message.includes(value),value);
});
test('product titles expose native keyboard-equivalent expansion and preserve action binding',()=>{
 const js=fs.readFileSync('app.v20260325.js','utf8'),css=fs.readFileSync('shared/customer-panel.css','utf8');
 assert.match(js,/role="button" tabindex="0" aria-expanded="false" data-action="toggle-product-title"/);
 const match=js.match(/'toggle-product-title': (\(el\) => \{[^\n]+\}),/);assert.ok(match);
 const classes=new Set(),attrs={};const el={classList:{toggle(name,force){const on=force===undefined?!classes.has(name):force;on?classes.add(name):classes.delete(name);return on;}},setAttribute:(k,v)=>attrs[k]=v};
 const toggle=vm.runInNewContext(match[1]);toggle(el);assert.equal(attrs['aria-expanded'],'true');assert.ok(classes.has('is-expanded'));toggle(el);assert.equal(attrs['aria-expanded'],'false');
 assert.match(js,/event.key==='Enter'\|\|event.key===' '/);assert.match(css,/-webkit-line-clamp:3/);assert.match(css,/\.product-title\.is-expanded/);
});
test('completion cannot clear cart or confirm receipt without WhatsApp opening',()=>{
 let confirmations=0;const ctx={state:{lastOrderId:'saved',whatsappOpened:false},toast(){},window:{DoseCartSync:{confirm(){confirmations++;}}}};vm.runInNewContext(fn('completeWhatsappOrder')+';completeWhatsappOrder()',ctx);assert.equal(confirmations,0);
});
test('one protected Pagnottella entry and Hub link resolves under GitHub Pages base',()=>{
 const hub=fs.readFileSync('index.html','utf8'),card=hub.match(/<article id="card-pagnottella"[\s\S]*?<\/article>/)[0];assert.equal((card.match(/<a /g)||[]).length,1);assert.match(card,/href="\.\/pagnottella-gourmet\/index.html"/);
 const russo=fs.readFileSync('russo/index.html','utf8'),base=new URL(russo.match(/<base href="([^"]+)/)[1],'https://example.test/dosepranza/russo/index.html');const href=russo.match(/class="russo-hub-return" href="([^"]+)/)[1];assert.equal(new URL(href,base).pathname,'/dosepranza/index.html');
});
test('guided markup preserves checkout IDs and follows summary-payment-WhatsApp order',()=>{
 const html=fs.readFileSync('pagnottella-gourmet/index.html','utf8');assert.ok(html.indexOf('1. Riepilogo')<html.indexOf('2. Scegli'));assert.ok(html.indexOf('2. Scegli')<html.indexOf('3. Invia'));
 for(const id of ['search','sendOrderBtn','paymentConfirmAccept','whatsappCompleteBtn','cartPrimaryAction'])assert.equal((html.match(new RegExp(`id="${id}"`,'g'))||[]).length,1);
});
