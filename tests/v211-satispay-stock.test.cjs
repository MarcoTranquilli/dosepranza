const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const api=require('../shared/satispay-and-stock.cjs');
const recipientId='5683f7f2-a4f8-4e0d-b8f9-f00af32b8ecb';
const plain=value=>JSON.parse(JSON.stringify(value));
test('v211: payment arithmetic, cents precedence and documented universal link',()=>{
 const p=api.buildSatispayPayload({recipientId,amountEuro:4.5+3.2,note:'ordine & allergie'});
 assert.equal(p.ready,true);assert.equal(p.amountCents,770);assert.equal(p.formattedAmount,'7,70 €');
 assert.equal(p.deepLink,`https://www.satispay.com/app/pay/shops/${recipientId}?amount=770`);
 assert.equal(p.webFallbackUrl,p.deepLink);assert.equal(p.noteSupported,false);
 assert.equal(api.buildSatispayPayload({recipientId,amountEuro:'7,70 €'}).amountCents,770);
 assert.equal(api.buildSatispayPayload({recipientId,amountCents:450,amountEuro:99}).amountCents,450);
});
test('v211: absent recipient, nonpositive or unsafe amount and injected base are safe',()=>{
 assert.equal(api.buildSatispayPayload({amountCents:700}).reason,'missing_recipient');
 for(const amountCents of [0,-1,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])assert.equal(api.buildSatispayPayload({recipientId,amountCents}).ready,false);
 assert.equal(api.buildSatispayPayload({recipientId:'../evil',amountCents:100}).ready,false);
 assert.equal(api.buildSatispayPayload({recipientId,amountCents:100,baseUrl:'javascript:alert(1)'}).ready,false);
});
test('v211: QR is deterministic, accessible, bounded and never interpolates input markup',()=>{
 const url=api.buildSatispayPayload({recipientId,amountCents:770}).deepLink;
 const svg=api.renderQrCodeSvg(url,{size:294,margin:2});
 assert.match(svg,/viewBox="0 0 49 49"/);assert.match(svg,/role="img"/);assert.match(svg,/aria-label=/);assert.match(svg,/#111827/);assert.match(svg,/#ffffff/);
 assert.equal(svg,api.renderQrCodeSvg(url,{size:294,margin:2}));
 assert.doesNotMatch(api.renderQrCodeSvg('<script>alert(1)</script>'),/<script>/);
 assert.throws(()=>api.renderQrCodeSvg('x'.repeat(135)),/134/);
});
test('v211: normalized stock trims, deduplicates NFD and handles timestamps',()=>{
 const state=api.normalizeStockState({soldOutItems:[' Supplì ','SUPPLI','Pane',null],soldOutIngredients:[' Brìe ','brie'],updatedAt:{toMillis:()=>123}});
 assert.deepEqual(plain(state),{soldOutItems:['Supplì','Pane'],soldOutIngredients:['Brìe'],updatedAt:123});
 assert.equal(api.normalizeStockState({updatedAt:{toMillis(){throw Error();}}}).updatedAt,null);
});
test('v211: item IDs and accent-insensitive ingredient phrases match without substring collisions',()=>{
 assert.equal(api.isCatalogItemSoldOut({id:'A'}, {soldOutItems:['a']}).reason,'item');
 assert.equal(api.isCatalogItemSoldOut({name:'SUPPLI'}, {soldOutItems:['Supplì']}).soldOut,true);
 assert.equal(api.isCatalogItemSoldOut({desc:'Pane, BRÌE e rucola'}, {soldOutIngredients:['brie']}).reason,'ingredient');
 assert.equal(api.isCatalogItemSoldOut({name:'Brioche'}, {soldOutIngredients:['brie']}).soldOut,false);
 assert.equal(api.isCatalogItemSoldOut({extras:[{name:'Pomodori secchi'}]}, {soldOutIngredients:['pomodori secchi']}).soldOut,true);
});
test('v211: reconciliation preserves quantities, prices and input objects',()=>{
 const a={id:'a',name:'Pane',qty:3,price:4},b={id:'b',name:'Insalata',qty:2,price:5};
 const items=Object.freeze([Object.freeze(a),Object.freeze(b)]);
 const result=api.reconcileCartWithStock(items,{soldOutItems:['a']});
 assert.equal(result.availableItems[0],b);assert.equal(result.removedItems[0].item,a);
 assert.equal(result.removedItems[0].reason,'item');assert.equal(a.qty,3);
 assert.deepEqual(plain(api.reconcileCartWithStock(null,null)),{availableItems:[],removedItems:[]});
});
test('v211: browser UMD and CJS have the same behavior',()=>{
 const ctx={TextEncoder};vm.runInNewContext(fs.readFileSync('shared/satispay-and-stock.js','utf8'),ctx);
 assert.equal(typeof ctx.DosePranzaSatispayStock.renderQrCodeSvg,'function');
 assert.deepEqual(plain(ctx.DosePranzaSatispayStock.buildSatispayPayload({recipientId,amountCents:200})),plain(api.buildSatispayPayload({recipientId,amountCents:200})));
});
test('v211: new relative assets resolve respecting Russo base href',()=>{
 for(const file of ['russo/index.html','russo/ordini.html','pagnottella-gourmet/index.html','pagnottella-gourmet/ordini.html']){
  const html=fs.readFileSync(file,'utf8');const doc=new URL(file,'https://example.test/dosepranza/');
  const base=html.match(/<base\s+href="([^"]+)"/);const url=base?new URL(base[1],doc):doc;
  for(const m of html.matchAll(/(?:src|href)="([^"]*(?:satispay|supplier-stock)[^"]*)"/g)){
   if(m[1].startsWith('https:'))continue;
   const asset=new URL(m[1],url);assert.ok(asset.pathname.startsWith('/dosepranza/'));
   assert.ok(fs.existsSync(path.join(process.cwd(),asset.pathname.slice('/dosepranza/'.length))),m[1]);
  }
 }
});
test('v211: generated Russo catalog stays aligned with source',()=>{
 const source=fs.readFileSync('app.v20260325.js','utf8');const start=source.indexOf('const DIETS_CONFIG'),end=source.indexOf('\n        };',source.indexOf('const RAW_MENU'))+12;
 const raw=vm.runInNewContext(source.slice(start,end)+'; RAW_MENU');
 const expected=Object.entries(raw).flatMap(([cat,items])=>items.map((item,index)=>({...item,cat,id:cat.replace(/\s/g,'')+index})));
 assert.deepEqual(JSON.parse(fs.readFileSync('assets/russo-stock-menu.json','utf8')).products,plain(expected));
});
